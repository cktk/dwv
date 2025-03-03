import {WindowLevel} from './windowLevel';
import {Scroll} from './scroll';
import {ZoomAndPan} from './zoomPan';
import {Opacity} from './opacity';
import {Draw} from './draw';
import {Floodfill} from './floodfill';
import {Livewire} from './livewire';

import {ArrowFactory} from './arrow';
import {CircleFactory} from './circle';
import {EllipseFactory} from './ellipse';
import {ProtractorFactory} from './protractor';
import {RectangleFactory} from './rectangle';
import {RoiFactory} from './roi';
import {RulerFactory} from './ruler';

import {Filter, Threshold, Sobel, Sharpen} from './filter';

/**
 * List of client provided tools to be added to
 * the default ones.
 *
 * @example
 * // custom tool
 * class AlertTool {
 *   mousedown() {alert('AlertTool mousedown');}
 *   init() {}
 *   activate() {}
 * }
 * // pass it to dwv tool list
 * dwv.toolList['Alert'] = AlertTool;
 * // create the dwv app
 * const app = new dwv.App();
 * // initialise
 * const viewConfig0 = new dwv.ViewConfig('layerGroup0');
 * const viewConfigs = {'*': [viewConfig0]};
 * const options = new dwv.AppOptions(viewConfigs);
 * options.tools = {Alert: {}};
 * app.init(options);
 * // activate tool
 * app.addEventListener('load', function () {
 *   app.setTool('Alert');
 * });
 * // load dicom data
 * app.loadURLs([
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm'
 * ]);
 *
 * @type {Object<string, any>}
 */
export const toolList = {};

export const defaultToolList = {
  WindowLevel,
  Scroll,
  ZoomAndPan,
  Opacity,
  Draw,
  Filter,
  Floodfill,
  Livewire
};

export const toolOptions = {
  draw: {
    ArrowFactory,
    CircleFactory,
    EllipseFactory,
    ProtractorFactory,
    RectangleFactory,
    RoiFactory,
    RulerFactory
  },
  filter: {
    Threshold,
    Sobel,
    Sharpen
  }
};