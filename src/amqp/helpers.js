function clone(obj, depth) {
  // we only need to clone reference types (Object)
  if (!(obj instanceof Object) ||
    obj instanceof Date ||
    depth > 2) {
    return obj
  }

  const copy = {};
  for (const i in obj) {
    if (Array.isArray(obj[i])) {
      copy[i] = obj[i].slice(0)
    } else if (obj[i] instanceof Buffer) {
      copy[i] = obj[i].slice(0)
    } else if (typeof obj[i] !== 'function') {
      copy[i] = obj[i] instanceof Object ? clone(obj[i], depth + 1) : obj[i]
    } else if (typeof obj[i] === 'function') {
      copy[i] = obj[i]
    }
  }

  return copy
}

module.exports = {
  clone
}
