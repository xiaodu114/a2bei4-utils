const AudioStreamResamplerProcessorCode = `
class AudioStreamResamplerProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const config = options.processorOptions || {};
        this.targetSampleRate = config.targetSampleRate || 16000;
        this.sourceSampleRate = sampleRate;
        this.downsampleRatio = this.sourceSampleRate / this.targetSampleRate;

        // 16000Hz 用 60ms chunk (960 samples)，其他用 1024
        this.chunkSize = this.targetSampleRate === 16000 ? 960 : 1024;

        const sourceBufferSize = config.sourceBufferSize || 16384; // ~340ms @48kHz
        const pcmBufferSize = config.pcmBufferSize || (this.chunkSize * 10); // 更大缓冲，减少溢出概率

        this.sourceBuffer = new Float32Array(sourceBufferSize);
        this.sourceBufferLength = 0;

        this.pcmBuffer = new Int16Array(pcmBufferSize);
        this.pcmBufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0 || input[0].length === 0) return true;
        const inputChannel = input[0];

        // 1. 写入源缓冲区（溢出时覆盖最旧数据）
        const newLength = this.sourceBufferLength + inputChannel.length;
        if (newLength > this.sourceBuffer.length) {
            const overflow = newLength - this.sourceBuffer.length;
            this.sourceBuffer.copyWithin(0, overflow);
            this.sourceBufferLength = this.sourceBuffer.length - inputChannel.length;
        }
        this.sourceBuffer.set(inputChannel, this.sourceBufferLength);
        this.sourceBufferLength += inputChannel.length;

        // 2. 计算可降采样样本数
        const availableOutputSamples = Math.floor(this.sourceBufferLength / this.downsampleRatio);
        if (availableOutputSamples === 0) return true;

        // 3. 线性插值降采样
        const downsampled = new Float32Array(availableOutputSamples);
        for (let i = 0; i < availableOutputSamples; i++) {
            const srcIndex = i * this.downsampleRatio;
            const srcIndexInt = Math.floor(srcIndex);
            const fraction = srcIndex - srcIndexInt;
            const val0 = this.sourceBuffer[srcIndexInt];
            const val1 = srcIndexInt + 1 < this.sourceBufferLength ? this.sourceBuffer[srcIndexInt + 1] : val0;
            downsampled[i] = val0 + (val1 - val0) * fraction;
        }

        // 4. Float32 → Int16 PCM
        const pcmData = this.floatTo16BitPCM(downsampled);

        // 5. 写入 PCM 缓冲区（空间不足时直接覆盖最旧，缓冲区足够大基本不会触发）
        if (this.pcmBufferIndex + pcmData.length > this.pcmBuffer.length) {
            // 简单策略：从头覆盖（丢弃最旧数据）
            this.pcmBufferIndex = 0;
        }
        this.pcmBuffer.set(pcmData, this.pcmBufferIndex);
        this.pcmBufferIndex += pcmData.length;

        // 6. 发送所有完整的 chunk（关键：复制到新数组再转移）
        while (this.pcmBufferIndex >= this.chunkSize) {
            // 方法1：推荐，使用 slice（隐式复制到新 ArrayBuffer）
            const chunk = this.pcmBuffer.slice(0, this.chunkSize);

            // 方法2：等价写法
            // const chunk = new Int16Array(this.pcmBuffer.subarray(0, this.chunkSize));

            this.port.postMessage(chunk, [chunk.buffer]); // 转移新缓冲区，安全！

            // 移动剩余数据到开头
            this.pcmBuffer.copyWithin(0, this.chunkSize, this.pcmBufferIndex);
            this.pcmBufferIndex -= this.chunkSize;
        }

        // 7. 清理已消费的源数据
        const consumedSrc = Math.floor(availableOutputSamples * this.downsampleRatio + 0.5); // 四舍五入更准
        if (consumedSrc > 0) {
            this.sourceBuffer.copyWithin(0, consumedSrc, this.sourceBufferLength);
            this.sourceBufferLength -= consumedSrc;
        }

        return true;
    }

    floatTo16BitPCM(input) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    }
}

registerProcessor('audio-stream-resampler-processor', AudioStreamResamplerProcessor);
`;

/**
 * 浏览器端实时音频流重采样器。
 * 基于 AudioWorklet 将麦克风/媒体流转换为 16 kHz、16-bit、单声道 PCM，
 * 并通过回调逐块输出，可选保存完整 PCM 用于后续合并。
 */
export class AudioStreamResampler {
    /**
     * @param {object} config
     * @param {function(Int16Array)} config.onData - 收到一个 chunk PCM 数据的回调
     * @param {function(string, string)} [config.onStateChange] - 状态变化回调
     * @param {object} [config.processorOptions] - 传递给 AudioWorklet 的选项
     * @param {boolean} [config.saveFullPcm=false] - 是否在内部保存所有 PCM 用于 stop 时合并（长时间录音建议关闭）
     */
    constructor(config) {
        this.onData = config.onData || (() => {});
        this.onStateChange = config.onStateChange || (() => {});
        this.processorOptions = config.processorOptions || {};
        this.saveFullPcm = config.saveFullPcm ?? false;

        this.audioContext = null;
        this.workletNode = null;
        this.source = null;
        this.workletUrl = null;
        this.fullPcmData = this.saveFullPcm ? [] : null;

        this.isInitialized = false;
        this.isProcessing = false;
    }

    /**
     * 初始化 AudioContext 并加载 AudioWorklet。
     * 完成后状态变为 `"ready"`。
     */
    async init() {
        this.onStateChange("initializing", "正在初始化音频环境...");
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            const blob = new Blob([AudioStreamResamplerProcessorCode], { type: "application/javascript" });
            this.workletUrl = URL.createObjectURL(blob);
            await this.audioContext.audioWorklet.addModule(this.workletUrl);

            this.workletNode = new AudioWorkletNode(this.audioContext, "audio-stream-resampler-processor", {
                processorOptions: this.processorOptions
            });

            this.workletNode.port.onmessage = (event) => {
                const chunk = event.data; // Int16Array
                this.onData(chunk);
                if (this.saveFullPcm) {
                    this.fullPcmData.push(chunk);
                }
            };

            this.isInitialized = true;
            this.onStateChange("ready", "音频环境已就绪");
        } catch (err) {
            console.error("AudioStreamResampler init error:", err);
            this.onStateChange("error", `初始化失败: ${err.message}`);
        }
    }

    /**
     * 绑定媒体流，开始实时处理。
     * @param {MediaStream} stream - 通过 getUserMedia 或其他方式获得的流
     */
    setMediaStream(stream) {
        if (!this.isInitialized) {
            console.error("请先调用 init()");
            return;
        }

        if (this.source) {
            this.source.disconnect();
        }

        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.workletNode);
        // workletNode 默认连接到 destination，可选断开以静音
        // this.workletNode.connect(this.audioContext.destination);

        this.isProcessing = true;
        this.onStateChange("processing", "正在处理音频流...");
    }

    /**
     * 停止处理并释放资源。
     * @param {(fullPcm: Int16Array) => void} [callback] - 若构造时 `saveFullPcm=true`，会把合并后的完整 PCM 通过此回调传出
     */
    stop(callback) {
        if (!this.isProcessing) return;

        this.onStateChange("stopping", "正在停止...");

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        this._cleanup();

        this.onStateChange("stopped", "已停止");

        if (this.saveFullPcm && callback && typeof callback === "function") {
            const totalLength = this.fullPcmData.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of this.fullPcmData) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }
            callback(combined);
        }
    }

    _cleanup() {
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode.port.close();
            this.workletNode = null;
        }
        if (this.audioContext && this.audioContext.state !== "closed") {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.workletUrl) {
            URL.revokeObjectURL(this.workletUrl);
            this.workletUrl = null;
        }

        this.isProcessing = false;
        this.isInitialized = false;
        if (this.fullPcmData) {
            this.fullPcmData.length = 0;
        }
    }
}

/**
 * 将 16-bit 单声道 PCM 数据封装成标准 WAV Blob。
 *
 * @param {Int16Array} pcmData - PCM 采样数据
 * @param {number} [sampleRate=16000] - 采样率，默认 16 kHz
 * @returns {Blob} audio/wav Blob
 */
export function pcmToWavBlob(pcmData, sampleRate = 16000) {
    const length = pcmData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * 2, true);
    let offset = 44;
    for (let i = 0; i < length; i++) {
        view.setInt16(offset, pcmData[i], true);
        offset += 2;
    }
    return new Blob([buffer], { type: "audio/wav" });
}
