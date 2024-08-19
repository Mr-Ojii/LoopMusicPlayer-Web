import * as musicMetadata from 'music-metadata-browser';


interface SoundInfo {
    file: Blob,
    metadata: any,
    loopStart: number | null,
    loopLength: number | null,
    loopEnd: number | null,
    title: string,
    artist: string | undefined,
    arrayBuffer: AudioBuffer,
    id: number,
}

let sound_list: SoundInfo[] = [];
const context: AudioContext = new AudioContext();
const gainNode: GainNode = context.createGain();
gainNode.connect(context.destination);
let source: AudioBufferSourceNode | null | undefined = null;
let sound: SoundInfo | null | undefined = null;
let startTime: number = 0;
let mus_id: number = 0;

let file_dom = document.getElementById("file") as HTMLInputElement;
let loading_dom = document.getElementById("loading") as HTMLDivElement;
file_dom.onchange = async () => {
    loading_dom.innerHTML = "loading...";
    file_dom.disabled = true;

    try {
        if (!file_dom.files)
            return;
        let blob = file_dom.files[0];
        let fileBufferArray = await blob.arrayBuffer();
        const metadata = await musicMetadata.parseBlob(blob);

        // console.log(blob);
        // console.log(metadata);

        if (metadata == null || metadata.native == null || metadata.format == null || metadata.format.sampleRate == null) {
            alert("failed to read audio data.");
            return;
        }

        let loopStart : number | null = null;
        let loopLength : number | null = null;
        let loopEnd : number | null = null;

        if (metadata.native.vorbis != null) {
            const loopStartITag = metadata.native.vorbis.find((v) => v.id.toUpperCase() === "LOOPSTART");
            const loopLengthITag = metadata.native.vorbis.find((v) => v.id.toUpperCase() === "LOOPLENGTH");
            const loopEndITag = metadata.native.vorbis.find((v) => v.id.toUpperCase() === "LOOPEND");

            if (loopStartITag !== undefined)
                loopStart = Number(loopStartITag.value);
            if (loopLengthITag !== undefined)
                loopLength = Number(loopLengthITag.value);
            if (loopEndITag !== undefined)
                loopEnd = Number(loopEndITag.value);

            if (loopEnd == null && loopStart != null && loopLength != null)
                loopEnd = loopStart + loopLength;

            if (loopLength == null && loopStart != null && loopEnd != null)
                loopLength = loopEnd - loopStart;
        }


        let decodedBufferArray = await context.decodeAudioData(fileBufferArray);

        const new_snd: SoundInfo = {
            file: blob,
            metadata: metadata,
            loopStart: loopStart,
            loopLength: loopLength,
            loopEnd: loopEnd,
            //??と?は違う動きをする
            title: metadata.common.title ? metadata.common.title : blob.name,
            artist: metadata.common.artist,
            arrayBuffer: decodedBufferArray,
            id: mus_id++,
        };
        if (new_snd.metadata.format.numberOfSamples === undefined)
        {
            new_snd.metadata.format.numberOfSamples = Math.ceil(new_snd.metadata.format.duration * new_snd.metadata.format.sampleRate);
        }

        sound_list.push(new_snd);

        let tr = document.createElement("tr");
        {
            let td = document.createElement("td");
            let inp = document.createElement("input");
            inp.type = "radio";
            inp.name = "selected";
            inp.value = String(new_snd.id);
            td.appendChild(inp);
            tr.appendChild(td);
        }
        {
            let td = document.createElement("td");
            td.innerText = new_snd.title;
            tr.appendChild(td);
        }
        {
            let td = document.createElement("td");
            td.innerText = getFormattedTimeStr(new_snd.metadata.format.duration);
            tr.appendChild(td);
        }
        {
            let td = document.createElement("td");
            td.innerText = (new_snd.loopStart && new_snd.loopEnd) ? "Loop" : "";
            tr.appendChild(td);
        }
        {
            let td = document.createElement("td");
            td.innerText = new_snd.artist ?? "";
            tr.appendChild(td);
        }
        {
            let td = document.createElement("td");
            let but = document.createElement("button") as HTMLButtonElement;
            but.innerText = "Remove";
            but.name = "Remove";
            but.value = String(new_snd.id);
            but.addEventListener('click', remove_list);
            td.appendChild(but);
            tr.appendChild(td);
        }
        (document.getElementById("tbody") as HTMLTableElement).appendChild(tr);
    }
    finally {
        file_dom.disabled = false;
        loading_dom.innerHTML = "";
    }
}

let play_dom = document.getElementById("button-play") as HTMLButtonElement;
play_dom.onclick = () => {
    let selected = -1;
    let elements = document.getElementsByName("selected") as NodeListOf<HTMLInputElement>;
    for (let i = 0; i < elements.length; i++) {
        if (elements.item(i).checked) {
            selected = Number(elements.item(i).value);
            break;
        }
    }
    if (selected === -1) {
        alert("not selected");
        return;
    }
    sound = sound_list.find(snd => snd.id == selected);
    if (!sound) {
        alert("file not found");
        return;
    }

    playStop();

    playStart(0);
    if (!source) {
        alert("internal error (source is undefined)");
        return;
    }

    if (context.state === "suspended") {
        context.resume();
    }

    let title_dom = document.getElementById("sound-title");
    if (title_dom)
        title_dom.innerHTML = "Title:" + sound.title + (sound.artist ? " / " + sound.artist : "");
    let loop_range_dom = document.getElementById("sound-loop-range");
    if (loop_range_dom)
        loop_range_dom.innerHTML = "LoopRange:" + getFormattedTimeStr(source.loopStart) + "-" + getFormattedTimeStr(source.loopEnd);
}

let pause_dom = document.getElementById("button-pause") as HTMLButtonElement;
pause_dom.onclick = () => {
    if (context.state === "suspended") {
        context.resume();
    } else {
        context.suspend();
    }
}

let stop_dom = document.getElementById("button-stop") as HTMLButtonElement;
stop_dom.onclick = () => {
    playStop();
}

let volume_dom = document.getElementById("range-volume") as HTMLInputElement;
volume_dom.oninput = () => {
    gainNode.gain.value = Number(volume_dom.value);
}

let seekbar_dom = document.getElementById("seekbar") as HTMLCanvasElement;
seekbar_dom.onmouseup = (e: MouseEvent) => {
    if (!source || !sound)
        return;

    const canvas = seekbar_dom;
    const rect = (e.target as Element).getBoundingClientRect();

    const x = Math.max(Math.min(e.clientX - rect.left, canvas.width - 5), 5) - 5;

    const ratio = x / (canvas.width - 10);
    const offset = ratio * sound.metadata.format.duration;

    playStop();
    playStart(offset);
}

function playStart(offset: number) {
    if (!sound)
        return;
    source = context.createBufferSource();
    source.connect(gainNode);
    source.buffer = sound.arrayBuffer;
    source.start(0, offset);
    startTime = context.currentTime - offset;
    source.loop = true;
    if (sound.loopStart !== null && sound.loopEnd !== null) {
        source.loopStart = sound.loopStart / sound.metadata.format.sampleRate;
        source.loopEnd = sound.loopEnd / sound.metadata.format.sampleRate;
        if (offset >= source.loopEnd)
            source.loop = false;
    }
}

function playStop() {
    if (source) {
        source.stop(0);
        source.disconnect();
        source = null;
    }
}

function drawCall() {
    const canvas = document.getElementById("seekbar") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgb(230, 230, 230)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(5, 5, canvas.width - 10, canvas.height - 10);


    if (source && sound) {
        if (sound.loopStart !== null && sound.loopEnd !== null && sound.loopLength !== null) {
            ctx.fillStyle = 'rgb(54, 132, 228)';
            ctx.fillRect((canvas.width - 10) * (sound.loopStart / sound.metadata.format.numberOfSamples) + 5, 5, (canvas.width - 10) * (sound.loopLength / sound.metadata.format.numberOfSamples), canvas.height - 10);
        }

        const current = getCurrentTime();
        let cr = ((current / sound.metadata.format.duration) * (canvas.width - 10));
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(cr, 0, 10, canvas.height);
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(cr + 1, 1, 8, canvas.height - 2);
    }
}

function getFormattedTimeStr(time: number) {
    let hour = Math.floor(time / 3600);
    let min = Math.floor((time / 60) % 60);
    let sec = Math.floor(time % 60);
    let mili = Math.floor(time * 100) % 100;

    return (("0" + hour).slice(-2)) + ":" + (("0" + min).slice(-2)) + ":" + (("0" + sec).slice(-2)) + "." + (("0" + mili).slice(-2));
}

function getCurrentTime() {
    if (!sound || !source)
        return 0;
    let current = context.currentTime - startTime;
    if (sound.loopStart !== null && sound.loopEnd !== null && sound.loopLength !== null && source.loop === true) {
        let endTime = (sound.loopEnd / sound.metadata.format.sampleRate);
        while (current > endTime)
            current = current - (sound.loopLength / sound.metadata.format.sampleRate);
    }
    else if (source.loop === true) {
        let endTime = sound.metadata.format.duration;
        while (current > endTime)
            current = current - endTime;
    }
    else {
        current = Math.min(current, sound.metadata.format.duration);
    }
    return current;
}

function updateCurrentTime() {
    if (source) {
        const dom = document.getElementById("sound-current-time");
        if (dom) {
            dom.innerHTML = "CurrentTime:" + getFormattedTimeStr(getCurrentTime());
        }
    }
}

function remove_list(e: MouseEvent) {
    sound_list = sound_list.filter(snd => snd.id != Number((e.target as HTMLButtonElement).value))
    const tbl = document.getElementById("tbody") as HTMLTableElement;
    for (let i = 0; i < tbl.children.length; i++) {
        if ((tbl.children[i].children[0].children[0] as HTMLButtonElement).value == (e.target as HTMLButtonElement).value) {
            tbl.deleteRow(i);
            break;
        }
    }

    // console.log(sound_list);
}

setInterval(drawCall, 50);
setInterval(updateCurrentTime, 100);