'use strict';
const localContext = localCanvas.getContext('2d');
const remoteContext = remoteCanvas.getContext('2d');

const src = '../wasm/vpx-worker.js';
const vpxdec_ = new Worker(src);

const vpxconfig_ = {};

vpxconfig_.codec = 'VP8';
vpxconfig_.width = 320;
vpxconfig_.height = 240;
vpxconfig_.fps = 30;
vpxconfig_.bitrate = 600;
vpxconfig_.packetSize = 16;

vpxdec_.postMessage({ type: 'init', data: vpxconfig_ });

navigator.mediaDevices
  .getUserMedia({ video: { width: 320, height: 240 } })
  .then((stream) => {
    localVideo.srcObject = stream;
    var mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs="vp9"' });
    var contuine = true;

    let decbuf = new Uint8Array(1 << 20);
    let decbuflen = 0;
    mediaRecorder.ondataavailable = function (e) {
      if (e.data.size > 0) {
        console.log(e.data);
        const data = new Uint8Array(e.data);
        decbuf.set(data, decbuflen);
        decbuflen += data.length;
        if (data.length == 16384) return; // wait for the final chunk of the incoming frame

        const packets = decbuf.slice(0, decbuflen);
        decbuflen = 0;

        vpxdec_.postMessage(
          {
            id: 'dec',
            type: 'call',
            name: 'decode',
            args: [packets.buffer],
          },
          [packets.buffer]
        );
      }
      if (mediaRecorder.state == 'recording' && contuine) {
        mediaRecorder.requestData();
      }
    };

    mediaRecorder.start();
    mediaRecorder.requestData();

    const width = 320;
    const height = 240;

    localCanvas.width = width;
    localCanvas.height = height;
    remoteCanvas.width = width;
    remoteCanvas.height = height;

    vpxdec_.onmessage = (e) => {
      console.log(e);
      contuine = false;
      if (e.data.res) {
        const decoded = new Uint8Array(e.data.res);
        const frame = remoteContext.createImageData(320, 240);
        frame.data.set(decoded, 0);
        console.log(decoded.byteLength);
        remoteContext.putImageData(frame, 0, 0);
      }
    };
  });
