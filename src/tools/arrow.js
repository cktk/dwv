import {Line, getPerpendicularLine, getAngle} from '../math/line';
import {Point2D} from '../math/point';
import {defaults} from '../app/defaults';
import {logger} from '../utils/logger';
import {DRAW_DEBUG, getDefaultAnchor} from './drawBounds';

// external
import Konva from 'konva';

// doc imports
/* eslint-disable no-unused-vars */
import {Style} from '../gui/style';
import {Annotation} from '../image/annotation';
/* eslint-enable no-unused-vars */

/**
 * Arrow factory.
 */
export class ArrowFactory {
  /**
   * Get the name of the shape group.
   *
   * @returns {string} The name.
   */
  getGroupName() {
    return 'line-group';
  }

  /**
   * Get the number of points needed to build the shape.
   *
   * @returns {number} The number of points.
   */
  getNPoints() {
    return 2;
  }

  /**
   * Get the timeout between point storage.
   *
   * @returns {number} The timeout in milliseconds.
   */
  getTimeout() {
    return 0;
  }

  /**
   * Is the input group a group of this factory?
   *
   * @param {Konva.Group} group The group to test.
   * @returns {boolean} True if the group is from this fcatory.
   */
  isFactoryGroup(group) {
    return this.getGroupName() === group.name();
  }

  /**
   * Set an annotation math shape from input points.
   *
   * @param {Annotation} annotation The annotation.
   * @param {Point2D[]} points The points.
   */
  setAnnotationMathShape(annotation, points) {
    annotation.mathShape = this.#calculateMathShape(points);
    annotation.referencePoints = [points[1]];
    annotation.setTextExpr(this.#getDefaultLabel());
    annotation.updateQuantification();
  }

  /**
   * Create a line shape to be displayed.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Style} style The drawing style.
   * @returns {Konva.Group} The Konva group.
   */
  createShapeGroup(annotation, style) {
    // konva group
    const group = new Konva.Group();
    group.name(this.getGroupName());
    group.visible(true);
    group.id(annotation.id);
    // konva shape
    group.add(this.#createShape(annotation, style));
    // extras
    const extras = this.#createShapeExtras(annotation, style);
    for (const extra of extras) {
      group.add(extra);
    }
    // konva label
    group.add(this.#createLabel(annotation, style));
    // konva shadow (if debug)
    if (DRAW_DEBUG) {
      group.add(this.#getDebugShadow(annotation));
    }
    return group;
  }

  /**
   * Get anchors to update a line shape.
   *
   * @param {Konva.Line} shape The associated shape.
   * @param {Style} style The application style.
   * @returns {Konva.Ellipse[]} A list of anchors.
   */
  getAnchors(shape, style) {
    const points = shape.points();

    // compensate for possible shape drag
    const anchors = [];
    anchors.push(getDefaultAnchor(
      points[0] + shape.x(), points[1] + shape.y(), 'begin', style
    ));
    anchors.push(getDefaultAnchor(
      points[2] + shape.x(), points[3] + shape.y(), 'end', style
    ));
    return anchors;
  }

  /**
   * Constrain anchor movement.
   *
   * @param {Konva.Ellipse} _anchor The active anchor.
   */
  constrainAnchorMove(_anchor) {
    // no constraints
  }

  /**
   * Update shape and label on anchor move taking the updated
   *   annotation as input.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Konva.Ellipse} anchor The active anchor.
   * @param {Style} style The application style.
   */
  updateShapeGroupOnAnchorMove(annotation, anchor, style) {
    // parent group
    const group = anchor.getParent();
    if (!(group instanceof Konva.Group)) {
      return;
    }

    // update shape and anchors
    this.#updateShape(annotation, anchor, style);
    // update label
    this.updateLabelContent(annotation, group, style);
    // TODO check if linked label...
    this.updateLabelPosition(annotation, group, style);
    // update shadow
    if (DRAW_DEBUG) {
      this.#updateDebugShadow(annotation, group);
    }
  }

  /**
   * Update an annotation on anchor move.
   *
   * @param {Annotation} annotation The annotation.
   * @param {Konva.Shape} anchor The anchor.
   */
  updateAnnotationOnAnchorMove(annotation, anchor) {
    // parent group
    const group = anchor.getParent();
    if (!(group instanceof Konva.Group)) {
      return;
    }
    // associated shape
    const kline = group.getChildren(function (node) {
      return node.name() === 'shape';
    })[0];
    if (!(kline instanceof Konva.Line)) {
      return;
    }
    // find anchors
    const begin = group.getChildren(function (node) {
      return node.id() === 'begin';
    })[0];
    const end = group.getChildren(function (node) {
      return node.id() === 'end';
    })[0];

    // math shape
    // compensate for possible shape drag
    const pointBegin = new Point2D(
      begin.x() - kline.x(),
      begin.y() - kline.y()
    );
    const pointEnd = new Point2D(
      end.x() - kline.x(),
      end.y() - kline.y()
    );
    annotation.mathShape = pointBegin;
    annotation.referencePoints = [pointEnd];
    // label position
    // TODO...
    // quantification
    annotation.updateQuantification();
  }

  /**
   * Update an annotation on translation (shape move).
   *
   * @param {Annotation} annotation The annotation.
   * @param {object} translation The translation.
   */
  updateAnnotationOnTranslation(annotation, translation) {
    // math shape
    const point = annotation.mathShape;
    const endPoint = annotation.referencePoints[0];
    const line = new Line(point, endPoint);

    const begin = line.getBegin();
    const newBegin = new Point2D(
      begin.getX() + translation.x,
      begin.getY() + translation.y
    );
    const end = line.getEnd();
    const newEnd = new Point2D(
      end.getX() + translation.x,
      end.getY() + translation.y
    );
    annotation.mathShape = newBegin;
    annotation.referencePoints = [newEnd];
    // label position
    const labelPos = annotation.labelPosition;
    if (typeof labelPos !== 'undefined') {
      const newPos = new Point2D(
        labelPos.getX() + translation.x,
        labelPos.getY() + translation.y
      );
      annotation.labelPosition = newPos;
    }
    // quantification
    annotation.updateQuantification();
  }

  /**
   * Update the shape label position.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Konva.Group} group The shape group.
   * @param {Style} _style The application style.
   */
  updateLabelPosition(annotation, group, _style) {
    // associated label
    const klabel = group.getChildren(function (node) {
      return node.name() === 'label';
    })[0];
    if (!(klabel instanceof Konva.Label)) {
      return;
    }
    // update position
    const labelPosition = this.#getLabelPosition(annotation);
    klabel.position({
      x: labelPosition.getX(),
      y: labelPosition.getY()
    });
  }

  /**
   * Update the shape label.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Konva.Group} group The shape group.
   * @param {Style} _style The application style.
   */
  updateLabelContent(annotation, group, _style) {
    // associated label
    const klabel = group.getChildren(function (node) {
      return node.name() === 'label';
    })[0];
    if (!(klabel instanceof Konva.Label)) {
      return;
    }
    // update text
    const text = annotation.getText();
    const ktext = klabel.getText();
    ktext.setText(text);
    // hide if visible and empty
    if (klabel.visible()) {
      klabel.visible(text.length !== 0);
    }
  }

  /**
   * Calculates the mathematical shape: a line.
   *
   * @param {Point2D[]} points The points that define the shape.
   * @returns {Point2D} The mathematical shape.
   */
  #calculateMathShape(points) {
    return points[0];
  }

  /**
   * Get the default labels.
   *
   * @returns {object} The label list.
   */
  #getDefaultLabel() {
    return defaults.labelText.arrow;
  }

  /**
   * Creates the konva shape.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Style} style The drawing style.
   * @returns {Konva.Line} The konva shape.
   */
  #createShape(annotation, style) {
    const point = annotation.mathShape;
    const endPoint = annotation.referencePoints[0];
    const line = new Line(point, endPoint);

    // konva line
    const kshape = new Konva.Line({
      points: [
        point.getX(),
        point.getY(),
        endPoint.getX(),
        endPoint.getY()
      ],
      stroke: annotation.colour,
      strokeWidth: style.getStrokeWidth(),
      strokeScaleEnabled: false,
      name: 'shape'
    });

    // larger hitfunc
    const tickLen = style.applyZoomScale(10).x;
    const linePerp0 = getPerpendicularLine(line, point, tickLen);
    const linePerp1 = getPerpendicularLine(line, endPoint, tickLen);
    kshape.hitFunc(function (context) {
      context.beginPath();
      context.moveTo(linePerp0.getBegin().getX(), linePerp0.getBegin().getY());
      context.lineTo(linePerp0.getEnd().getX(), linePerp0.getEnd().getY());
      context.lineTo(linePerp1.getEnd().getX(), linePerp1.getEnd().getY());
      context.lineTo(linePerp1.getBegin().getX(), linePerp1.getBegin().getY());
      context.closePath();
      context.fillStrokeShape(kshape);
    });

    return kshape;
  }

  /**
   * Creates the konva shape extras.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Style} style The drawing style.
   * @returns {Array} The konva shape extras.
   */
  #createShapeExtras(annotation, style) {
    const point = annotation.mathShape;
    const endPoint = annotation.referencePoints[0];
    const line = new Line(point, endPoint);

    const beginTy = new Point2D(
      point.getX(),
      point.getY() - 10);
    const verticalLine = new Line(point, beginTy);
    const angle = getAngle(line, verticalLine);
    const angleRad = angle * Math.PI / 180;
    const radius = Math.abs(style.applyZoomScale(8).x);
    const kpoly = new Konva.RegularPolygon({
      x: point.getX() + radius * Math.sin(angleRad),
      y: point.getY() + radius * Math.cos(angleRad),
      sides: 3,
      radius: radius,
      rotation: -angle,
      fill: annotation.colour,
      strokeWidth: style.getStrokeWidth(),
      strokeScaleEnabled: false,
      name: 'shape-triangle'
    });

    return [kpoly];
  }

  /**
   * Get the default annotation label position.
   *
   * @param {Annotation} annotation The annotation.
   * @returns {Point2D} The position.
   */
  #getDefaultLabelPosition(annotation) {
    const point = annotation.mathShape;
    return point;
  }

  /**
   * Get the annotation label position.
   *
   * @param {Annotation} annotation The annotation.
   * @returns {Point2D} The position.
   */
  #getLabelPosition(annotation) {
    let res = annotation.labelPosition;
    if (typeof res === 'undefined') {
      res = this.#getDefaultLabelPosition(annotation);
    }
    return res;
  }

  /**
   * Creates the konva label.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Style} style The drawing style.
   * @returns {Konva.Label} The Konva label.
   */
  #createLabel(annotation, style) {
    // konva text
    const ktext = new Konva.Text({
      fontSize: style.getFontSize(),
      fontFamily: style.getFontFamily(),
      fill: annotation.colour,
      padding: style.getTextPadding(),
      shadowColor: style.getShadowLineColour(),
      shadowOffset: style.getShadowOffset(),
      name: 'text'
    });
    const labelText = annotation.getText();
    ktext.setText(labelText);

    // konva label
    const labelPosition = this.#getLabelPosition(annotation);
    const klabel = new Konva.Label({
      x: labelPosition.getX(),
      y: labelPosition.getY(),
      scale: style.applyZoomScale(1),
      visible: labelText.length !== 0,
      name: 'label'
    });
    klabel.add(ktext);
    klabel.add(new Konva.Tag({
      fill: annotation.colour,
      opacity: style.getTagOpacity()
    }));

    return klabel;
  }

  /**
   * Update shape and label on anchor move taking the updated
   *   annotation as input.
   *
   * @param {Annotation} annotation The associated annotation.
   * @param {Konva.Ellipse} anchor The active anchor.
   * @param {Style} style The application style.
   */
  #updateShape(annotation, anchor, style) {
    const point = annotation.mathShape;
    const endPoint = annotation.referencePoints[0];
    const line = new Line(point, endPoint);

    // parent group
    const group = anchor.getParent();
    if (!(group instanceof Konva.Group)) {
      return;
    }
    // associated shape
    const kline = group.getChildren(function (node) {
      return node.name() === 'shape';
    })[0];
    if (!(kline instanceof Konva.Line)) {
      return;
    }

    // reset position after possible shape drag
    kline.position({x: 0, y: 0});
    // update shape
    kline.points([
      point.getX(),
      point.getY(),
      endPoint.getX(),
      endPoint.getY(),
    ]);

    // associated triangle shape
    const ktriangle = group.getChildren(function (node) {
      return node.name() === 'shape-triangle';
    })[0];
    if (!(ktriangle instanceof Konva.RegularPolygon)) {
      return;
    }
    // find anchors
    const begin = group.getChildren(function (node) {
      return node.id() === 'begin';
    })[0];
    const end = group.getChildren(function (node) {
      return node.id() === 'end';
    })[0];

    // update 'self' (undo case)
    switch (anchor.id()) {
    case 'begin':
      begin.x(anchor.x());
      begin.y(anchor.y());
      break;
    case 'end':
      end.x(anchor.x());
      end.y(anchor.y());
      break;
    default:
      logger.error('Unhandled anchor id: ' + anchor.id());
      break;
    }

    // triangle
    const beginTy = new Point2D(
      line.getBegin().getX(),
      line.getBegin().getY() - 10);
    const verticalLine = new Line(line.getBegin(), beginTy);
    const angle = getAngle(line, verticalLine);
    const angleRad = angle * Math.PI / 180;
    ktriangle.x(
      line.getBegin().getX() + ktriangle.radius() * Math.sin(angleRad));
    ktriangle.y(
      line.getBegin().getY() + ktriangle.radius() * Math.cos(angleRad));
    ktriangle.rotation(-angle);

    // larger hitfunc
    const tickLen = style.applyZoomScale(10).x;
    const linePerp0 = getPerpendicularLine(line, point, tickLen);
    const linePerp1 = getPerpendicularLine(line, endPoint, tickLen);
    kline.hitFunc(function (context) {
      context.beginPath();
      context.moveTo(linePerp0.getBegin().getX(), linePerp0.getBegin().getY());
      context.lineTo(linePerp0.getEnd().getX(), linePerp0.getEnd().getY());
      context.lineTo(linePerp1.getEnd().getX(), linePerp1.getEnd().getY());
      context.lineTo(linePerp1.getBegin().getX(), linePerp1.getBegin().getY());
      context.closePath();
      context.fillStrokeShape(kline);
    });
  }

  /**
   * Get the debug shadow.
   *
   * @param {Annotation} _annotation The annotation to shadow.
   * @param {Konva.Group} [_group] The associated group.
   * @returns {Konva.Group|undefined} The shadow konva group.
   */
  #getDebugShadow(_annotation, _group) {
    return;
  }

  /**
   * Update the debug shadow.
   *
   * @param {Annotation} _annotation The annotation to shadow.
   * @param {Konva.Group} _group The associated group.
   */
  #updateDebugShadow(_annotation, _group) {
    // does nothing
  }

} // class ArrowFactory
