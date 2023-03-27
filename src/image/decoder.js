import {ThreadPool, WorkerTask} from '../utils/thread';

/**
 * The JPEG baseline decoder.
 *
 * @external JpegImage
 * @see https://github.com/mozilla/pdf.js/blob/master/src/core/jpg.js
 */
/* global JpegImage */
var hasJpegBaselineDecoder = (typeof JpegImage !== 'undefined');

/**
 * The JPEG decoder namespace.
 *
 * @external jpeg
 * @see https://github.com/rii-mango/JPEGLosslessDecoderJS
 */
/* global jpeg */
var hasJpegLosslessDecoder = (typeof jpeg !== 'undefined') &&
    (typeof jpeg.lossless !== 'undefined');

/**
 * The JPEG 2000 decoder.
 *
 * @external JpxImage
 * @see https://github.com/jpambrun/jpx-medical/blob/master/jpx.js
 */
/* global JpxImage */
var hasJpeg2000Decoder = (typeof JpxImage !== 'undefined');

export let decoderScripts = {};

/**
 * Asynchronous pixel buffer decoder.
 *
 * @class
 * @param {string} script The path to the decoder script to be used
 *   by the web worker.
 * @param {number} _numberOfData The anticipated number of data to decode.
 */
class AsynchPixelBufferDecoder {

  #script;

  constructor(script, _numberOfData) {
    this.#script = script;
  }

  // initialise the thread pool
  #pool = new ThreadPool(10);
  // flag to know if callbacks are set
  #areCallbacksSet = false;

  /**
   * Decode a pixel buffer.
   *
   * @param {Array} pixelBuffer The pixel buffer.
   * @param {object} pixelMeta The input meta data.
   * @param {object} info Information object about the input data.
   */
  decode(pixelBuffer, pixelMeta, info) {
    if (!this.#areCallbacksSet) {
      this.#areCallbacksSet = true;
      // set event handlers
      this.#pool.onworkstart = this.ondecodestart;
      this.#pool.onworkitem = this.ondecodeditem;
      this.#pool.onwork = this.ondecoded;
      this.#pool.onworkend = this.ondecodeend;
      this.#pool.onerror = this.onerror;
      this.#pool.onabort = this.onabort;
    }
    // create worker task
    var workerTask = new WorkerTask(
      this.#script,
      {
        buffer: pixelBuffer,
        meta: pixelMeta
      },
      info
    );
    // add it the queue and run it
    this.#pool.addWorkerTask(workerTask);
  }

  /**
   * Abort decoding.
   */
  abort() {
    // abort the thread pool, will trigger pool.onabort
    this.#pool.abort();
  }

  /**
   * Handle a decode start event.
   * Default does nothing.
   *
   * @param {object} _event The decode start event.
   */
  ondecodestart(_event) {}

  /**
   * Handle a decode item event.
   * Default does nothing.
   *
   * @param {object} _event The decode item event fired
   *   when a decode item ended successfully.
   */
  ondecodeditem(_event) {}

  /**
   * Handle a decode event.
   * Default does nothing.
   *
   * @param {object} _event The decode event fired
   *   when a file has been decoded successfully.
   */
  ondecoded(_event) {}

  /**
   * Handle a decode end event.
   * Default does nothing.
   *
   * @param {object} _event The decode end event fired
   *  when a file decoding has completed, successfully or not.
   */
  ondecodeend(_event) {}

  /**
   * Handle an error event.
   * Default does nothing.
   *
   * @param {object} _event The error event.
   */
  onerror(_event) {}

  /**
   * Handle an abort event.
   * Default does nothing.
   *
   * @param {object} _event The abort event.
   */
  onabort(_event) {}

} // class AsynchPixelBufferDecoder

/**
 * Synchronous pixel buffer decoder.
 *
 * @class
 * @param {string} algoName The decompression algorithm name.
 * @param {number} numberOfData The anticipated number of data to decode.
 */
class SynchPixelBufferDecoder {

  #algoName;
  #numberOfData;

  constructor(algoName, numberOfData) {
    this.#algoName = algoName;
    this.#numberOfData = numberOfData;
  }

  // decode count
  #decodeCount = 0;

  /**
   * Decode a pixel buffer.
   *
   * @param {Array} pixelBuffer The pixel buffer.
   * @param {object} pixelMeta The input meta data.
   * @param {object} info Information object about the input data.
   * @external jpeg
   * @external JpegImage
   * @external JpxImage
   */
  decode(pixelBuffer, pixelMeta, info) {
    ++this.#decodeCount;

    var decoder = null;
    var decodedBuffer = null;
    if (this.#algoName === 'jpeg-lossless') {
      if (!hasJpegLosslessDecoder) {
        throw new Error('No JPEG Lossless decoder provided');
      }
      // bytes per element
      var bpe = pixelMeta.bitsAllocated / 8;
      var buf = new Uint8Array(pixelBuffer);
      decoder = new jpeg.lossless.Decoder();
      var decoded = decoder.decode(buf.buffer, 0, buf.buffer.byteLength, bpe);
      if (pixelMeta.bitsAllocated === 8) {
        if (pixelMeta.isSigned) {
          decodedBuffer = new Int8Array(decoded.buffer);
        } else {
          decodedBuffer = new Uint8Array(decoded.buffer);
        }
      } else if (pixelMeta.bitsAllocated === 16) {
        if (pixelMeta.isSigned) {
          decodedBuffer = new Int16Array(decoded.buffer);
        } else {
          decodedBuffer = new Uint16Array(decoded.buffer);
        }
      }
    } else if (this.#algoName === 'jpeg-baseline') {
      if (!hasJpegBaselineDecoder) {
        throw new Error('No JPEG Baseline decoder provided');
      }
      decoder = new JpegImage();
      decoder.parse(pixelBuffer);
      decodedBuffer = decoder.getData(decoder.width, decoder.height);
    } else if (this.#algoName === 'jpeg2000') {
      if (!hasJpeg2000Decoder) {
        throw new Error('No JPEG 2000 decoder provided');
      }
      // decompress pixel buffer into Int16 image
      decoder = new JpxImage();
      decoder.parse(pixelBuffer);
      // set the pixel buffer
      decodedBuffer = decoder.tiles[0].items;
    } else if (this.#algoName === 'rle') {
      // decode DICOM buffer
      decoder = new dwv.decoder.RleDecoder();
      // set the pixel buffer
      decodedBuffer = decoder.decode(
        pixelBuffer,
        pixelMeta.bitsAllocated,
        pixelMeta.isSigned,
        pixelMeta.sliceSize,
        pixelMeta.samplesPerPixel,
        pixelMeta.planarConfiguration);
    }
    // send decode events
    this.ondecodeditem({
      data: [decodedBuffer],
      index: info.itemNumber
    });
    // decode end?
    if (this.#decodeCount === this.#numberOfData) {
      this.ondecoded({});
      this.ondecodeend({});
    }
  }

  /**
   * Abort decoding.
   */
  abort() {
    // nothing to do in the synchronous case.
    // callback
    this.onabort({});
    this.ondecodeend({});
  }

  /**
   * Handle a decode start event.
   * Default does nothing.
   *
   * @param {object} _event The decode start event.
   */
  ondecodestart(_event) {}

  /**
   * Handle a decode item event.
   * Default does nothing.
   *
   * @param {object} _event The decode item event fired
   *   when a decode item ended successfully.
   */
  ondecodeditem(_event) {}

  /**
   * Handle a decode event.
   * Default does nothing.
   *
   * @param {object} _event The decode event fired
   *   when a file has been decoded successfully.
   */
  ondecoded(_event) {}

  /**
   * Handle a decode end event.
   * Default does nothing.
   *
   * @param {object} _event The decode end event fired
   *  when a file decoding has completed, successfully or not.
   */
  ondecodeend(_event) {}

  /**
   * Handle an error event.
   * Default does nothing.
   *
   * @param {object} _event The error event.
   */
  onerror(_event) {}

  /**
   * Handle an abort event.
   * Default does nothing.
   *
   * @param {object} _event The abort event.
   */
  onabort(_event) {}

} // class SynchPixelBufferDecoder

/**
 * Decode a pixel buffer.
 *
 * @class
 * @param {string} algoName The decompression algorithm name.
 * @param {number} numberOfData The anticipated number of data to decode.
 * If the 'decoderScripts' variable does not contain the desired,
 * algorythm the decoder will switch to the synchronous mode.
 */
export class PixelBufferDecoder {

  #algoName;
  #numberOfData;
  /**
   * Pixel decoder.
   * Defined only once.
   *
   * @private
   * @type {object}
   */
  #pixelDecoder = null;

  constructor(algoName, numberOfData) {
    this.#algoName = algoName;
    this.#numberOfData = numberOfData;

    // initialise the asynch decoder (if possible)
    if (typeof decoderScripts !== 'undefined' &&
      typeof decoderScripts[algoName] !== 'undefined') {
      this.#pixelDecoder = new AsynchPixelBufferDecoder(
        decoderScripts[algoName], numberOfData);
    } else {
      this.#pixelDecoder = new SynchPixelBufferDecoder(
        algoName, numberOfData);
    }

  }

  // flag to know if callbacks are set
  #areCallbacksSet = false;

  /**
   * Get data from an input buffer using a DICOM parser.
   *
   * @param {Array} pixelBuffer The input data buffer.
   * @param {object} pixelMeta The input meta data.
   * @param {object} info Information object about the input data.
   */
  decode(pixelBuffer, pixelMeta, info) {
    if (!this.#areCallbacksSet) {
      this.#areCallbacksSet = true;
      // set callbacks
      this.#pixelDecoder.ondecodestart = this.ondecodestart;
      this.#pixelDecoder.ondecodeditem = this.ondecodeditem;
      this.#pixelDecoder.ondecoded = this.ondecoded;
      this.#pixelDecoder.ondecodeend = this.ondecodeend;
      this.#pixelDecoder.onerror = this.onerror;
      this.#pixelDecoder.onabort = this.onabort;
    }
    // decode and call the callback
    this.#pixelDecoder.decode(pixelBuffer, pixelMeta, info);
  }

  /**
   * Abort decoding.
   */
  abort() {
    // decoder classes should define an abort
    this.#pixelDecoder.abort();
  }

  /**
   * Handle a decode start event.
   * Default does nothing.
   *
   * @param {object} _event The decode start event.
   */
  ondecodestart(_event) {}

  /**
   * Handle a decode item event.
   * Default does nothing.
   *
   * @param {object} _event The decode item event fired
   *   when a decode item ended successfully.
   */
  ondecodeditem(_event) {}

  /**
   * Handle a decode event.
   * Default does nothing.
   *
   * @param {object} _event The decode event fired
   *   when a file has been decoded successfully.
   */
  ondecoded(_event) {}

  /**
   * Handle a decode end event.
   * Default does nothing.
   *
   * @param {object} _event The decode end event fired
   *  when a file decoding has completed, successfully or not.
   */
  ondecodeend(_event) {}

  /**
   * Handle an error event.
   * Default does nothing.
   *
   * @param {object} _event The error event.
   */
  onerror(_event) {}

  /**
   * Handle an abort event.
   * Default does nothing.
   *
   * @param {object} _event The abort event.
   */
  onabort(_event) {}

} // class PixelBufferDecoder
