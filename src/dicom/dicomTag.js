import {
  dictionary,
  tagGroups
} from './dictionary';

/**
 * Immutable tag.
 */
export class Tag {

  /**
   * The tag group.
   *
   * @type {string}
   */
  #group;

  /**
   * The tag element.
   *
   * @type {string}
   */
  #element;

  /**
   * @param {string} group The tag group as '####'.
   * @param {string} element The tag element as '####'.
   */
  constructor(group, element) {
    if (!group || typeof group === 'undefined') {
      throw new Error('Cannot create tag with no group.');
    }
    if (group.length !== 4) {
      throw new Error('Cannot create tag with badly sized group.');
    }
    if (!element || typeof element === 'undefined') {
      throw new Error('Cannot create tag with no element.');
    }
    if (element.length !== 4) {
      throw new Error('Cannot create tag with badly sized element.');
    }
    this.#group = group;
    this.#element = element;
  }

  /**
   * Get the tag group.
   *
   * @returns {string} The tag group.
   */
  getGroup() {
    return this.#group;
  }

  /**
   * Get the tag element.
   *
   * @returns {string} The tag element.
   */
  getElement() {
    return this.#element;
  }

  /**
   * Get as string representation of the tag: 'key: name'.
   *
   * @returns {string} A string representing the tag.
   */
  toString() {
    return this.getKey() + ': ' + this.getNameFromDictionary();
  }

  /**
   * Check for Tag equality.
   *
   * @param {Tag} rhs The other tag to compare to.
   * @returns {boolean} True if both tags are equal.
   */
  equals(rhs) {
    return rhs !== null &&
      typeof rhs !== 'undefined' &&
      this.getGroup() === rhs.getGroup() &&
      this.getElement() === rhs.getElement();
  }

  /**
   * Get the group-element key used to store DICOM elements.
   *
   * @returns {string} The key as '########'.
   */
  getKey() {
    return this.getGroup() + this.getElement();
  }

  /**
   * Get the group name as defined in TagGroups.
   *
   * @returns {string} The name.
   */
  getGroupName() {
    return tagGroups[this.getGroup()];
  }

  /**
   * Does this tag have a VR.
   * Basically the Item, ItemDelimitationItem and SequenceDelimitationItem tags.
   *
   * @returns {boolean} True if this tag has a VR.
   */
  isWithVR() {
    const element = this.getElement();
    return !(this.getGroup() === 'FFFE' &&
      (element === 'E000' || element === 'E00D' || element === 'E0DD')
    );
  }

  /**
   * Is the tag group a private tag group ?
   * see: http://dicom.nema.org/medical/dicom/2015a/output/html/part05.html#sect_7.8
   *
   * @returns {boolean} True if the tag group is private,
   *   ie if its group is an odd number.
   */
  isPrivate() {
    const groupNumber = parseInt(this.getGroup(), 16);
    return groupNumber % 2 === 1;
  }

  /**
   * Get the tag info from the dicom dictionary.
   *
   * @returns {Array|undefined} The info as [vr, multiplicity, name].
   */
  getInfoFromDictionary() {
    let info;
    if (typeof dictionary[this.getGroup()] !== 'undefined' &&
      typeof dictionary[this.getGroup()][this.getElement()] !==
        'undefined') {
      info = dictionary[this.getGroup()][this.getElement()];
    }
    return info;
  }

  /**
   * Get the tag Value Representation (VR) from the dicom dictionary.
   *
   * @returns {string|undefined} The VR.
   */
  getVrFromDictionary() {
    let vr;
    const info = this.getInfoFromDictionary();
    if (typeof info !== 'undefined') {
      vr = info[0];
    }
    return vr;
  }

  /**
   * Get the tag name from the dicom dictionary.
   *
   * @returns {string|undefined} The VR.
   */
  getNameFromDictionary() {
    let name;
    const info = this.getInfoFromDictionary();
    if (typeof info !== 'undefined') {
      name = info[2];
    }
    return name;
  }

} // Tag class

/**
 * Tag compare function.
 *
 * @param {Tag} a The first tag.
 * @param {Tag} b The second tag.
 * @returns {number} The result of the tag comparison,
 *   positive for b before a, negative for a before b and
 *   zero to keep same order.
 */
export function tagCompareFunction(a, b) {
  // first by group
  let res = parseInt(a.getGroup(), 16) - parseInt(b.getGroup(), 16);
  if (res === 0) {
    // by element if same group
    res = parseInt(a.getElement(), 16) - parseInt(b.getElement(), 16);
  }
  return res;
}

/**
 * Split a group-element key used to store DICOM elements.
 *
 * @param {string} key The key in form "00280102" as generated by tag::getKey.
 * @returns {Tag} The DICOM tag.
 */
export function getTagFromKey(key) {
  if (!key || typeof key === 'undefined') {
    throw new Error('Cannot create tag with no key.');
  }
  if (key.length !== 8) {
    throw new Error('Cannot create tag with badly sized key.');
  }
  return new Tag(key.substring(0, 4), key.substring(4, 8));
}

/**
 * Get the TransferSyntaxUID Tag.
 *
 * @returns {object} The tag.
 */
export function getTransferSyntaxUIDTag() {
  return new Tag('0002', '0010');
}

/**
 * Get the FileMetaInformationGroupLength Tag.
 *
 * @returns {object} The tag.
 */
export function getFileMetaInformationGroupLengthTag() {
  return new Tag('0002', '0000');
}

/**
 * Is the input tag the FileMetaInformationGroupLength Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isFileMetaInformationGroupLengthTag(tag) {
  return tag.equals(getFileMetaInformationGroupLengthTag());
}

/**
 * Get the Item Tag.
 *
 * @returns {Tag} The tag.
 */
export function getItemTag() {
  return new Tag('FFFE', 'E000');
}

/**
 * Is the input tag the Item Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isItemTag(tag) {
  return tag.equals(getItemTag());
}

/**
 * Get the ItemDelimitationItem Tag.
 *
 * @returns {Tag} The tag.
 */
export function getItemDelimitationItemTag() {
  return new Tag('FFFE', 'E00D');
}

/**
 * Is the input tag the ItemDelimitationItem Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isItemDelimitationItemTag(tag) {
  return tag.equals(getItemDelimitationItemTag());
}

/**
 * Get the SequenceDelimitationItem Tag.
 *
 * @returns {Tag} The tag.
 */
export function getSequenceDelimitationItemTag() {
  return new Tag('FFFE', 'E0DD');
}

/**
 * Is the input tag the SequenceDelimitationItem Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isSequenceDelimitationItemTag(tag) {
  return tag.equals(getSequenceDelimitationItemTag());
}

/**
 * Get the PixelData Tag.
 *
 * @returns {Tag} The tag.
 */
export function getPixelDataTag() {
  return new Tag('7FE0', '0010');
}

/**
 * Is the input tag the PixelData Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isPixelDataTag(tag) {
  return tag.equals(getPixelDataTag());
}

/**
 * Get a tag from the dictionary using a tag string name.
 *
 * @param {string} tagName The tag string name.
 * @returns {object|null} The tag object or null if not found.
 */
export function getTagFromDictionary(tagName) {
  if (typeof tagName === 'undefined' || tagName === null) {
    return null;
  }
  let group = null;
  let element = null;
  const dict = dictionary;
  const keys0 = Object.keys(dict);
  let keys1 = null;
  let foundTag = false;
  // search through dictionary
  for (let k0 = 0, lenK0 = keys0.length; k0 < lenK0; ++k0) {
    group = keys0[k0];
    keys1 = Object.keys(dict[group]);
    for (let k1 = 0, lenK1 = keys1.length; k1 < lenK1; ++k1) {
      element = keys1[k1];
      if (dict[group][element][2] === tagName) {
        foundTag = true;
        break;
      }
    }
    if (foundTag) {
      break;
    }
  }
  let tag = null;
  if (foundTag) {
    tag = new Tag(group, element);
  }
  return tag;
}
