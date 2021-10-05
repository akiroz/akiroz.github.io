
function wpm2unit(wpm) {
    return (60 * 1000) / (50 * wpm);
}

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

const morseDecode = {  
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

document.querySelector("input[name=swapKeys]").addEventListener("change", ({ target }) => {
    swapKeys = target.checked;
});

let wpm = 15;
document.querySelector("input[name=wpm]").addEventListener("change", ({ target }) => {
    const val = parseInt(target.value);
    if(Number.isFinite(val)) wpm = val;
});

document.querySelector("#clear").addEventListener("click", () => {
    document.querySelector("pre.text").textContent = "";
    document.querySelector("pre.code").textContent = "";
});

class Modulator {
    actx = new AudioContext();
    osc = this.actx.createOscillator();
    gain = this.actx.createGain();
    band = this.actx.createBiquadFilter();
    
    constructor() {
        this.osc.frequency.value = 550;
        this.osc.start();
        this.osc.connect(this.gain);
        this.gain.gain.value = 0.001;
        this.gain.connect(this.band);
        this.band.type = "bandpass";
        this.band.frequency.value = 550;
        this.band.Q.value = 3;
        this.band.connect(this.actx.destination);
    }

    start() {
        this.gain.gain.value = 1;
        document.querySelector("#i-tx").style.backgroundColor = "rgb(52, 199, 89)";
    }

    stop() {
        this.gain.gain.value = 0;
        document.querySelector("#i-tx").style.backgroundColor = "rgb(142, 142, 142)";
    }
}

class Keyer {
    dit = false;
    dah = false;
    prevKey = null;
    nextKey = null;
    idleUnits = 0;
    code = "";
    modulator = new Modulator();

    constructor() {
        document.body.addEventListener("keydown", ({ code, repeat }) => {
            if(repeat) return;
            const k = mapKey(code);
            if(k === ".") this.dit = true;
            if(k === "-") this.dah = true;
            if(k && !this.nextKey) this.nextKey = k;
            this.syncIndicators();
        });
        document.body.addEventListener("keyup", ({ code }) => {
            if(mapKey(code) === ".") this.dit = false;
            if(mapKey(code) === "-") this.dah = false;
            this.syncIndicators();
        });
        setTimeout(() => this.run(), 0);
    }

    syncIndicators() {
        document.querySelector("#i-dit").style.backgroundColor = this.dit ? "rgb(255, 149, 0)" : "rgb(142, 142, 142)";
        document.querySelector("#i-dah").style.backgroundColor = this.dah ? "rgb(255, 149, 0)" : "rgb(142, 142, 142)";
    }

    timeout(unit) {
        return new Promise(r => setTimeout(r, unit * wpm2unit(wpm)));
    }

    async append(key) {
        document.querySelector("pre.code").textContent += key;
        if(key === "\n") {
            document.querySelector("pre.text").textContent += "\n";
        }
        if(key === " ") {
            document.querySelector("pre.text").textContent += morseDecode[this.code] || "";
            this.code = "";
        }
        if(key === ".") {
            this.code += ".";
            this.modulator.start();
            await this.timeout(1);
            this.modulator.stop();
            await this.timeout(1);
        }
        if(key === "-") {
            this.code += "-";
            this.modulator.start();
            await this.timeout(3);
            this.modulator.stop();
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

window.keyer = new Keyer();