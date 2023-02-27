const musicMetadata = require('music-metadata-browser');

let sound_list = [];
const context = new AudioContext();
const gainNode = context.createGain();
gainNode.connect(context.destination);
let source = null;
let sound = null;
let startTime = 0;
let mus_id = 0;

document.getElementById("file").onchange = async() => {
    document.getElementById("loading").innerHTML = "loading...";
    document.getElementById("file").disabled = true;

    try
    {
        let blob = document.getElementById("file").files[0];
        let fileBufferArray = await blob.arrayBuffer();
        const metadata = await musicMetadata.parseBlob(blob);

        // console.log(blob);
        // console.log(metadata);

        if(metadata == null || metadata.native == null || metadata.format == null || metadata.format.sampleRate == null) {
            alert("failed to read audio data.");
            return;
        }

        let loopStart = null;
        let loopLength = null;
        let loopEnd = null;

        if(metadata.native.vorbis != null)
        {
            const loopStartITag = metadata.native.vorbis.find((v) => v.id.toUpperCase() === "LOOPSTART");
            const loopLengthITag = metadata.native.vorbis.find((v) => v.id.toUpperCase() === "LOOPLENGTH");
            const loopEndITag = metadata.native.vorbis.find((v) => v.id.toUpperCase() === "LOOPEND");

            if(loopStartITag !== undefined)
                loopStart = Number(loopStartITag.value);
            if(loopLengthITag !== undefined)
                loopLength = Number(loopLengthITag.value);
            if(loopEndITag !== undefined)
                loopEnd = Number(loopEndITag.value);

            if(loopEnd == null && loopStart != null && loopLength != null)
                loopEnd = loopStart + loopLength;

            if(loopLength == null && loopStart != null && loopEnd != null)
                loopLength = loopEnd - loopStart;
        }


        let decodedBufferArray = await context.decodeAudioData(fileBufferArray);

        const new_snd = {
            file: blob,
            metadata: metadata,
            loopStart: loopStart,
            loopLength: loopLength,
            loopEnd: loopEnd,
            //??と?は違う動きをする
            title: metadata.common.title ? metadata.common.title :  blob.name,
            artist: metadata.common.artist,
            arrayBuffer: decodedBufferArray,
            id: mus_id++,
        };

        sound_list.push(new_snd);
        
        let tr = document.createElement("tr");
        tr.value = new_snd.id;
        {
            let td = document.createElement("td");
            let inp = document.createElement("input");
            inp.type = "radio";
            inp.name = "selected";
            inp.value = new_snd.id;
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
            let but = document.createElement("button");
            but.innerText = "Remove";
            but.name = "Remove";
            but.value = new_snd.id;
            but.addEventListener('click', remove_list);
            td.appendChild(but);
            tr.appendChild(td);
        }
        document.getElementById("tbody").appendChild(tr);
    }
    finally
    {
        document.getElementById("file").disabled = false;
        document.getElementById("loading").innerHTML = "";
    }
}

document.getElementById("button-play").onclick = () => {
    let selected = -1;
    let elements = document.getElementsByName("selected");
    for (let i = 0; i < elements.length; i++){
        if (elements.item(i).checked){
            selected = elements.item(i).value;
            break;
        }
    }
    if(selected === -1) {
        alert("not selected");
        return;
    }
    sound = sound_list.find(snd => snd.id == selected);

    playStop();

    playStart(0);
    
    if(context.state === "suspended") {
        context.resume();
    }

    document.getElementById("sound-title").innerHTML = "Title:" + sound.title + (sound.artist ? " / " + sound.artist : "");
    document.getElementById("sound-loop-range").innerHTML = "LoopRange:" + getFormattedTimeStr(source.loopStart) + "-" +  getFormattedTimeStr(source.loopEnd);
}

document.getElementById("button-pause").onclick = () => {
    if(context.state === "suspended") {
        context.resume();
    } else {
        context.suspend();
    }
}

document.getElementById("button-stop").onclick = () => {
    playStop();
}

document.getElementById("range-volume").oninput = () => {
    gainNode.gain.value = document.getElementById("range-volume").value;
}

document.getElementById("seekbar").onmouseup = (e) => {
    if(!source)
        return;

    const canvas = document.getElementById("seekbar");
    const rect = e.target.getBoundingClientRect();

    const x = Math.max(Math.min(e.clientX - rect.left, canvas.width - 5), 5) - 5;

    const ratio = x / (canvas.width - 10);
    const offset = ratio * sound.metadata.format.duration;

    playStop();
    playStart(offset);
}

function playStart(offset) {
    source = context.createBufferSource();
    source.connect(gainNode);
    source.buffer = sound.arrayBuffer;
    source.start(0, offset);
    startTime = context.currentTime - offset;
    source.loop = true;
    if(sound.loopStart !== null && sound.loopEnd !== null)
    {
        source.loopStart = sound.loopStart / sound.metadata.format.sampleRate;
        source.loopEnd = sound.loopEnd / sound.metadata.format.sampleRate;
        if(offset >= source.loopEnd)
            source.loop = false;
    }
}

function playStop() {
    if(source)
    {
        source.stop(0);
        source.disconnect();
        source = null;
    }
}

function drawCall()
{
    const canvas = document.getElementById("seekbar");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgb(230, 230, 230)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(5, 5, canvas.width - 10, canvas.height - 10);
    

    if(source) {
        if(sound.loopStart !== null && sound.loopEnd !== null) {
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

function getFormattedTimeStr(time) {
    let hour = Math.floor(time / 3600);
    let min = Math.floor((time / 60) % 60);
    let sec = Math.floor(time % 60);
    let mili = Math.floor(time * 100) % 100;
    
    return (("0" + hour).slice(-2)) + ":" + (("0" + min).slice(-2)) + ":" + (("0" + sec).slice(-2)) + "." +  (("0" + mili).slice(-2));
}

function getCurrentTime() {
    let current = context.currentTime - startTime;
    if(sound.loopStart !== null && sound.loopEnd !== null && source.loop === true) {
        let endTime = (sound.loopEnd / sound.metadata.format.sampleRate);
        while(current > endTime)
            current = current - (sound.loopLength / sound.metadata.format.sampleRate);
    }
    else if (source.loop === true) {
        let endTime = sound.metadata.format.duration;
        while(current > endTime)
            current = current - endTime;
    }
    else {
        current = Math.min(current, sound.metadata.format.duration);
    }
    return current;
}

function updateCurrentTime() {
    if(source) {
        const dom = document.getElementById("sound-current-time");
        dom.innerHTML = "CurrentTime:" + getFormattedTimeStr(getCurrentTime());
    }
}

function remove_list(e) {
    sound_list = sound_list.filter(snd => snd.id != e.target.value)
    const tbl = document.getElementById("tbody");
    for(let i = 0; i < tbl.children.length; i++) {
        if(tbl.children[i].value == e.target.value) {
            tbl.deleteRow(i);
            break;
        }
    }
    
    // console.log(sound_list);
}

setInterval(drawCall, 50);
setInterval(updateCurrentTime, 100);