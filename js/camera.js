export class Camera {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.currentFacingMode = 'user';
    this.isActive = false;
  }

  async start(facingMode = 'user') {
    this.currentFacingMode = facingMode;
    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      this.isActive = true;
      return true;
    } catch (err) {
      console.error('Camera access denied:', err);
      this.isActive = false;
      throw err;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.isActive = false;
  }

  capture(filter = 'none') {
    if (!this.isActive || !this.video.videoWidth) return null;

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.filter = filter;
    ctx.drawImage(this.video, 0, 0);
    ctx.filter = 'none';
    return canvas;
  }

  async switchCamera() {
    const newFacing = this.currentFacingMode === 'user' ? 'environment' : 'user';

    if (this.stream && this.stream.getVideoTracks().length > 0) {
      const track = this.stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({ facingMode: newFacing });
        this.currentFacingMode = newFacing;
        return true;
      } catch {
        /* applyConstraints not supported, fall through to stop/start */
      }
    }

    this.stop();
    try {
      await this.start(newFacing);
      return true;
    } catch {
      try {
        await this.start('user');
      } catch {
        this.isActive = false;
      }
      return false;
    }
  }
}
