import {MultiProgressHandler} from '../utils/progress';
import {loaderList} from './loaderList';

// file content types
export const fileContentTypes = {
  Text: 0,
  ArrayBuffer: 1,
  DataURL: 2
};

/**
 * Files loader.
 */
export class FilesLoader {

  /**
   * Input data.
   *
   * @type {Array}
   */
  #inputData = null;

  /**
   * Array of launched file readers.
   *
   * @type {Array}
   */
  #readers = [];

  /**
   * Data loader.
   *
   * @type {object}
   */
  #runningLoader = null;

  /**
   * Number of loaded data.
   *
   * @type {number}
   */
  #nLoad = 0;

  /**
   * Number of load end events.
   *
   * @type {number}
   */
  #nLoadend = 0;

  /**
   * The default character set (optional).
   *
   * @type {string}
   */
  #defaultCharacterSet;

  /**
   * Get the default character set.
   *
   * @returns {string} The default character set.
   */
  getDefaultCharacterSet() {
    return this.#defaultCharacterSet;
  }

  /**
   * Set the default character set.
   *
   * @param {string} characterSet The character set.
   */
  setDefaultCharacterSet(characterSet) {
    this.#defaultCharacterSet = characterSet;
  }

  /**
   * Store the current input.
   *
   * @param {object} data The input data.
   */
  #storeInputData(data) {
    this.#inputData = data;
    // reset counters
    this.#nLoad = 0;
    this.#nLoadend = 0;
    // clear storage
    this.#clearStoredReaders();
    this.#clearStoredLoader();
  }

  /**
   * Store a launched reader.
   *
   * @param {object} reader The launched reader.
   */
  #storeReader(reader) {
    this.#readers.push(reader);
  }

  /**
   * Clear the stored readers.
   *
   */
  #clearStoredReaders() {
    this.#readers = [];
  }

  /**
   * Store the launched loader.
   *
   * @param {object} loader The launched loader.
   */
  #storeLoader(loader) {
    this.#runningLoader = loader;
  }

  /**
   * Clear the stored loader.
   *
   */
  #clearStoredLoader() {
    this.#runningLoader = null;
  }

  /**
   * Launch a load item event and call addLoad.
   *
   * @param {object} event The load data event.
   */
  #addLoadItem = (event) => {
    this.onloaditem(event);
    this.#addLoad();
  };

  /**
   * Increment the number of loaded data
   *   and call onload if loaded all data.
   *
   * @param {object} _event The load data event.
   */
  #addLoad = (_event) => {
    this.#nLoad++;
    // call onload when all is loaded
    // (not using the input event since it is not the
    //   general load)
    if (this.#nLoad === this.#inputData.length) {
      this.onload({
        source: this.#inputData
      });
    }
  };

  /**
   * Increment the counter of load end events
   *   and run callbacks when all done, erroneus or not.
   *
   * @param {object} _event The load end event.
   */
  #addLoadend = (_event) => {
    this.#nLoadend++;
    // call onloadend when all is run
    // (not using the input event since it is not the
    //   general load end)
    // x2 to count for reader + load
    if (this.#nLoadend === 2 * this.#inputData.length) {
      this.onloadend({
        source: this.#inputData
      });
    }
  };

  /**
   * Augment a callback event with a srouce.
   *
   * @param {object} callback The callback to augment its event.
   * @param {object} source The source to add to the event.
   * @returns {(event) => void} The augmented callback.
   */
  #augmentCallbackEvent(callback, source) {
    return (event) => {
      event.source = source;
      callback(event);
    };
  }

  /**
   * Load a list of files.
   *
   * @param {Array} data The list of files to load.
   */
  load(data) {
    // check input
    if (typeof data === 'undefined' || data.length === 0) {
      return;
    }
    this.#storeInputData(data);

    // send start event
    this.onloadstart({
      source: data
    });

    // create prgress handler
    const mproghandler = new MultiProgressHandler(this.onprogress);
    mproghandler.setNToLoad(data.length);

    // create loaders
    const loaders = [];
    for (let m = 0; m < loaderList.length; ++m) {
      loaders.push(new loaderList[m]());
    }

    // find an appropriate loader
    let dataElement = data[0];
    let loader = null;
    let foundLoader = false;
    for (let l = 0; l < loaders.length; ++l) {
      loader = loaders[l];
      if (loader.canLoadFile(dataElement)) {
        foundLoader = true;
        // load options
        loader.setOptions({
          numberOfFiles: data.length,
          defaultCharacterSet: this.getDefaultCharacterSet()
        });
        // set loader callbacks
        // loader.onloadstart: nothing to do
        loader.onprogress = mproghandler.getUndefinedMonoProgressHandler(1);
        if (typeof loader.onloaditem === 'undefined') {
          // handle loaditem locally
          loader.onload = this.#addLoadItem;
        } else {
          loader.onloaditem = this.onloaditem;
          loader.onload = this.#addLoad;
        }
        loader.onloadend = this.#addLoadend;
        loader.onerror = this.onerror;
        loader.onabort = this.onabort;

        // store loader
        this.#storeLoader(loader);
        // exit
        break;
      }
    }
    if (!foundLoader) {
      throw new Error('No loader found for file: ' + dataElement.name);
    }

    const getLoadHandler = function (loader, dataElement, i) {
      return (event) => {
        loader.load(event.target.result, dataElement, i);
      };
    };

    // loop on I/O elements
    for (let i = 0; i < data.length; ++i) {
      dataElement = data[i];

      // check loader
      if (!loader.canLoadFile(dataElement)) {
        throw new Error('Input file of different type: ' + dataElement);
      }

      /**
       * The file reader.
       *
       * @external FileReader
       * @see https://developer.mozilla.org/en-US/docs/Web/API/FileReader
       */
      const reader = new FileReader();
      // store reader
      this.#storeReader(reader);

      // set reader callbacks
      // reader.onloadstart: nothing to do
      reader.onprogress = this.#augmentCallbackEvent(
        mproghandler.getMonoProgressHandler(i, 0), dataElement);
      reader.onload = getLoadHandler(loader, dataElement, i);
      reader.onloadend = this.#addLoadend;
      reader.onerror = this.#augmentCallbackEvent(this.onerror, dataElement);
      reader.onabort = this.#augmentCallbackEvent(this.onabort, dataElement);
      // read
      if (loader.loadFileAs() === fileContentTypes.Text) {
        reader.readAsText(dataElement);
      } else if (loader.loadFileAs() === fileContentTypes.DataURL) {
        reader.readAsDataURL(dataElement);
      } else if (loader.loadFileAs() === fileContentTypes.ArrayBuffer) {
        reader.readAsArrayBuffer(dataElement);
      }
    }
  }

  /**
   * Abort a load.
   */
  abort() {
    // abort readers
    for (let i = 0; i < this.#readers.length; ++i) {
      // 0: EMPTY, 1: LOADING, 2: DONE
      if (this.#readers[i].readyState === 1) {
        this.#readers[i].abort();
      }
    }
    // abort loader
    if (this.#runningLoader && this.#runningLoader.isLoading()) {
      this.#runningLoader.abort();
    }
  }

  /**
   * Handle a load start event.
   * Default does nothing.
   *
   * @param {object} _event The load start event.
   */
  onloadstart(_event) {}

  /**
   * Handle a load progress event.
   * Default does nothing.
   *
   * @param {object} _event The progress event.
   */
  onprogress(_event) {}

  /**
   * Handle a load item event.
   * Default does nothing.
   *
   * @param {object} _event The load item event fired
   *   when a file item has been loaded successfully.
   */
  onloaditem(_event) {}

  /**
   * Handle a load event.
   * Default does nothing.
   *
   * @param {object} _event The load event fired
   *   when a file has been loaded successfully.
   */
  onload(_event) {}

  /**
   * Handle a load end event.
   * Default does nothing.
   *
   * @param {object} _event The load end event fired
   *  when a file load has completed, successfully or not.
   */
  onloadend(_event) {}

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

} // class FilesLoader
