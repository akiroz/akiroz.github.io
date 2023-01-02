
class Modulator {
    enable = true;
    actx = new AudioContext();
    osc = this.actx.createOscillator();
    gain = this.actx.createGain();
    band = this.actx.createBiquadFilter();
    
    constructor() {
        this.setFreq(750);
        this.osc.start();
        this.osc.connect(this.gain);
        this.gain.gain.value = 0;
        this.gain.connect(this.band);
        this.band.type = "bandpass";
        this.band.Q.value = 3;
        this.band.connect(this.actx.destination);
    }

    setFreq(hz) {
        this.osc.frequency.value = hz;
        this.band.frequency.value = hz;
    }

    output(high) {
        this.gain.gain.value = (this.enable && high) ? 1 : 0;
    }

}

class Keyer {
    // Controls
    wpm = 15;
    modeB = false;
    dit = false;
    dah = false;
    // Internal State
    prevKey = null;
    nextKey = null;
    idleUnits = 7;
    code = "";
    // Outputs
    onKey = () => {};
    onWord = () => {};
    onTxStart = () => {};
    onTxStop = () => {};

    constructor() {
        setTimeout(() => this.run(), 0);
    }

    queue(key) {
        if(key && !this.nextKey) this.nextKey = key;
    }

    timeout(unit) {
        const unitMs = (60 * 1000) / (50 * this.wpm);
        return new Promise(r => setTimeout(r, unit * unitMs));
    }

    async append(key) {
        this.onKey(key);
        if(key === "\n") {
            this.onWord("\n");
        }
        if(key === " ") {
            this.onWord(this.code);
            this.code = "";
        }
        if(key === ".") {
            this.code += ".";
            this.onTxStart();
            await this.timeout(1);
            this.onTxStop();
            await this.timeout(1);
        }
        if(key === "-") {
            this.code += "-";
            this.onTxStart();
            await this.timeout(3);
            this.onTxStop();
            await this.timeout(1);
        }
    }

    async run() {
        while(true) {
            let currKey = null;
            if(this.nextKey) {
                [this.nextKey, currKey] = [null, this.nextKey];
            } else if(this.dit && this.dah) {
                if(this.prevKey === ".") currKey = "-";
                if(this.prevKey === "-") currKey = ".";
            } else if(this.dit) {
                currKey = ".";
            } else if(this.dah) {
                currKey = "-";
            } else {
                const iu = this.idleUnits++;
                if(iu < 1 && this.idleUnits >= 1 && this.modeB) {
                    if(this.prevKey === ".") await this.append("-");
                    if(this.prevKey === "-") await this.append(".");
                    continue;
                }
                if(iu < 3 && this.idleUnits >= 3) this.append(" ");
                if(iu < 7 && this.idleUnits >= 7) this.append("\n");
                await this.timeout(1);
                continue;
            }
            await this.append(currKey);
            this.prevKey = currKey;
            this.idleUnits = 0;
        }
    }
}

const morseCode = {  
    "-----":"0",
    ".----":"1",
    "..---":"2",
    "...--":"3",
    "....-":"4",
    ".....":"5",
    "-....":"6",
    "--...":"7",
    "---..":"8",
    "----.":"9",
    ".-":"A",
    "-...":"B",
    "-.-.":"C",
    "-..":"D",
    ".":"E",
    "..-.":"F",
    "--.":"G",
    "....":"H",
    "..":"I",
    ".---":"J",
    "-.-":"K",
    ".-..":"L",
    "--":"M",
    "-.":"N",
    "---":"O",
    ".--.":"P",
    "--.-":"Q",
    ".-.":"R",
    "...":"S",
    "-":"T",
    "..-":"U",
    "...-":"V",
    ".--":"W",
    "-..-":"X",
    "-.--":"Y",
    "--..":"Z",
    "-.-.--":"!",
    ".-.-.-":".",
    "--..--":","
};

let modulator = null;
const keyer = new Keyer();

function getModulator() {
    if(modulator) return modulator;
    const freq = parseInt(document.querySelector("input[name=freq]").value);
    modulator = new Modulator();
    modulator.enable = document.querySelector("input[name=modEn]").checked;
    if(Number.isFinite(freq)) modulator.setFreq(freq);
    return modulator;

}

keyer.onTxStart = () => {
    getModulator().output(true);
    document.querySelector("#i-tx").style.backgroundColor = "rgb(52, 199, 89)";
}

keyer.onTxStop = () => {
    getModulator().output(false);
    document.querySelector("#i-tx").style.backgroundColor = "rgb(142, 142, 142)";
}

keyer.onKey = (key) => {
    document.querySelector("pre.code").textContent += key;
};

keyer.onWord = (code) => {
    const text = (code === "\n") ? code : morseCode[code] || ""
    document.querySelector("pre.text").textContent += text;
};

document.querySelector("input[name=modeB]").addEventListener("change", ({ target }) => {
    keyer.modeB = target.checked;
});

document.querySelector("input[name=wpm]").addEventListener("change", ({ target }) => {
    const val = parseInt(target.value);
    if(Number.isFinite(val)) keyer.wpm = val;
});

document.querySelector("input[name=modEn]").addEventListener("change", ({ target }) => {
    getModulator().enable = target.checked;
});

document.querySelector("input[name=freq]").addEventListener("change", ({ target }) => {
    const val = parseInt(target.value);
    if(Number.isFinite(val)) getModulator().setFreq(val);
});

document.querySelector("#clear").addEventListener("click", () => {
    document.querySelector("pre.text").textContent = "";
    document.querySelector("pre.code").textContent = "";
});

let swapKeys = false;
function mapKey(code) {
    switch(code) {
        case "KeyZ":
        case "Comma":
            return swapKeys ? "-" : ".";
        case "KeyX":
        case "Period":
            return swapKeys ? "." : "-";
    }
}
document.querySelector("input[name=swapKeys]").addEventListener("change", ({ target }) => {
    swapKeys = target.checked;
    document.querySelector("#key-dit").textContent = swapKeys ? "X/." : "Z/,";
    document.querySelector("#key-dah").textContent = swapKeys ? "Z/," : "X/.";
});

function syncIndicators({ dit, dah }) {
    document.querySelector("#i-dit").style.backgroundColor = dit ? "rgb(255, 149, 0)" : "rgb(142, 142, 142)";
    document.querySelector("#i-dah").style.backgroundColor = dah ? "rgb(255, 149, 0)" : "rgb(142, 142, 142)";
}

document.body.addEventListener("keydown", ({ code, repeat }) => {
    if(repeat) return;
    const k = mapKey(code);
    if(k === ".") keyer.dit = true;
    if(k === "-") keyer.dah = true;
    if(k) keyer.queue(k);
    syncIndicators(keyer);
});
document.body.addEventListener("keyup", ({ code }) => {
    if(mapKey(code) === ".") keyer.dit = false;
    if(mapKey(code) === "-") keyer.dah = false;
    syncIndicators(keyer);
});


document.querySelector("button[name=encoderSend]").addEventListener("click", async () => {
    input = document.querySelector("input[name=encoderInput]")
    input.value = input.value.replace(/[^A-Za-z-0-9 !\.,]/g, "").toUpperCase();
    const morse = Object.entries(morseCode).reduce((acc, [k,v]) => (acc[v] = k, acc), {});
    for(let c of input.value.split("")) {
        if(c === " ") {
            await keyer.timeout(7);
            await keyer.append("\n");
            continue;
        }
        for(let m of morse[c].split("")) {
            await keyer.append(m);
        }
        await keyer.timeout(3);
        await keyer.append(" ");
    }
    await keyer.append("\n");
});


