// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

Object.prototype.each = function (callback, scope) {
  var i, p, props = Object.keys(this);
  for (i = 0; i < props.length; ++i) {
    p = props[i];
    callback.apply(scope, [p, this[p]]);
  }
}

Array.prototype.each = function (callback, scope) {
  var i, N = this.length;
  for (i = 0; i < N; ++i)
    callback.apply(scope, [i, this[i]]);
}

Array.prototype.contains = function (val) {
  return this.indexOf(val) >= 0;
}

Array.prototype.remove = function (val) {
  var idx = this.indexOf(val);
  if (idx >= 0)
    this.splice(idx, 1);
};

Array.prototype.add = function (val) {
  if (!this.contains(val))
    this.push(val);
};

Array.prototype.insertBefore = function (idx, item) {
  this.splice(idx, 0, item);
}

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}


exports.pad0 = pad0;
