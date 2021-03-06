'use strict'

module.exports = createTrajectory
module.exports.fromJSON = fromJSON

var bsearch = require('binary-search-bounds')

function State(t, x, v, s) {
  this.t = t
  this.x = x
  this.v = v
  this.s = s
}

function Trajectory(states, createTime, destroyTime) {
  this.states       = states
  this.createTime   = createTime
  this.destroyTime  = destroyTime
}

var proto = Trajectory.prototype

proto.exists = function(t) {
  return (t >= this.createTime) && (t <= this.destroyTime)
}

function compareT(state, t) {
  return state.t - t
}

proto.state = function(t) {
  if(t > this.destroyTime || t < this.createTime) {
    return ''
  }
  var idx = bsearch.le(this.states, t, compareT)
  if(idx < 0) {
    return ''
  }
  return this.states[idx].s
}

proto.x = function(t, result) {
  if(t > this.destroyTime || t < this.createTime) {
    return null
  }
  var idx = bsearch.le(this.states, t, compareT)
  if(idx < 0) {
    return null
  }
  var a = this.states[idx]
  var dt = t - a.t
  if(!result) {
    result = a.x.slice()
  } else {
    result[0] = a.x[0]
    result[1] = a.x[1]
  }
  for(var i=0; i<2; ++i) {
    result[i] += dt * a.v[i]
  }
  return result
}

proto.v = function(t, result) {
  if(t > this.destroyTime || t < this.createTime) {
    return null
  }
  var idx = bsearch.le(this.states, t, compareT)
  if(idx < 0) {
    return null
  }
  var a = this.states[idx]
  if(!result) {
    result = a.v.slice()
  } else {
    result[0] = a.v[0]
    result[1] = a.v[1]
  }
  return result
}

function statesEqual(a, b) {
  if(Math.abs(b.v[0] - a.v[0]) + Math.abs(a.v[1] - b.v[1]) > 1e-6) {
    return false
  }
  if(a.s !== b.s) {
    return false
  }
  var t0 = a.t
  var t1 = b.t
  var dt = t1 - t0
  var nx = a.x[0] + dt*a.v[0]
  var ny = a.x[1] + dt*a.v[1]
  if(Math.abs(b.x[0]-nx) + Math.abs(b.x[1]-ny) > 1e-6) {
    return false
  }
  return true
}


function compressStates(states) {
  for(var i=states.length-1; i>0; --i) {
    if(statesEqual(states[i-1], states[i])) {
      states.pop()
    } else {
      break
    }
  }
}

proto.setVelocity = function(t, v) {
  var nextState = new State(t, this.x(t), v.slice(), this.states[this.states.length-1].s)
  compressStates(this.states)
  this.states.push(nextState)
}

proto.setState = function(t, value) {
  compressStates(this.states)
  var insertIndex = this.states.length
  for(var i=this.states.length-1; i>=0; --i) {
    if(t <= this.states[i].t) {
      this.states[i].s = value
      insertIndex = i
    }
  }
  var nextState = new State(t, this.x(t), this.v(t), value)
  this.states.splice(insertIndex, 0, nextState)
}

proto.setFull = function(t, x, v, s) {
  compressStates(this.states)
  this.states.push(new State(t, x, v, s))
}

proto.destroy = function(t) {
  var idx = bsearch.ge(this.states, t, compareT)+1
  this.states = this.states.slice(0, idx)
  compressStates(this.states)

  var x   = this.x(t)
  this.states.push(new State(t, x, [0,0], this.states[this.states.length-1].s))
  this.destroyTime = t
}

proto.toJSON = function() {
  return this
}

function createTrajectory(t, x, v, state) {
  var initState = new State(t, x.slice(), v.slice(), state)
  return new Trajectory([initState], t, Infinity)
}

function fromJSON(object) {
  var createTime  = +object.createTime
  var destroyTime = +object.destroyTime
  if(!object.destroyTime) {
    destroyTime = Infinity
  }
  return new Trajectory(object.states.map(function(s) {
    return new State(s.t, s.x.slice(), s.v.slice(), s.s)
  }), createTime, destroyTime)
}