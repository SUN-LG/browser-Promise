// function _Promise(fn) {
//   this.status = 'padding'
//   this.fulfilled = null
//   this.rejected = null
//   this.value = null
//   this.error = null
//   var _this = this
//   var resolve = function (value) {
//     _this.value = value
//     _this.status = 'fulfilled'
//     if (_this.fulfilled) _this.fulfilled(value)
//   }
//
//   var reject = function (error) {
//     _this.status = 'rejected'
//     _this.error = error
//     if (_this.rejected) _this.rejected(error)
//   }
//
//   fn.call(this, resolve, reject)
// }
//
// handle = function (status, fn) {
//   var _this = this
//   setTimeout(function () {
//     if (_this.status === status) fn(_this.value)
//     _this[status]= fn
//   }, 0)
// }
//
//
// var currying = function (fn) {
//   var args_1 = Array.prototype.slice.call(arguments, 1)
//   return function () {
//     var args_2 = Array.prototype.slice.call(arguments)
//     return fn.apply(this, args_1.concat(args_2))
//   }
// }
//
// _Promise.prototype.then = currying(handle, 'fulfilled')
// _Promise.prototype.catch = currying(handle, 'rejected')



function _Promise(executor) {
  // ...
  var self = this
  self.status = 'pending' // Promise当前的状态
  self.data = undefined  // Promise的值
  self.onResolvedCallback = [] // Promise resolve时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面
  self.onRejectedCallback = [] // Promise reject时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面

  function resolve(value) {
    if (value instanceof _Promise) return value.then(resolve, reject)

    setTimeout(function () {
      if (self.status === 'pending') {
        self.status = 'resolved'
        self.data = value
        for(var i = 0; i < self.onResolvedCallback.length; i++) {
          self.onResolvedCallback[i](value)
        }
      }
    })
  }

  function reject(reason) {
    setTimeout(function () {
      if (self.status === 'pending') {
        self.status = 'rejected'
        self.data = reason
        for(var i = 0; i < self.onRejectedCallback.length; i++) {
          self.onRejectedCallback[i](reason)
        }
      }
    })
  }

  // ...
  try { // 考虑到执行executor的过程中有可能出错，所以我们用try/catch块给包起来，并且在出错后以catch到的值reject掉这个Promise
    executor(resolve, reject) // 执行executor
  } catch(e) {
    reject(e)
  }
}

_Promise.prototype.then = function(onResolved, onRejected) {
  var self = this
  var promise2

  // 根据标准，如果then的参数不是function，则我们需要忽略它，此处以如下方式处理
  onResolved = typeof onResolved === 'function' ? onResolved : function(value) { return value }
  onRejected = typeof onRejected === 'function' ? onRejected : function(reason) { throw reason }

  if (self.status === 'resolved') {
    // 如果promise1(此处即为this/self)的状态已经确定并且是resolved，我们调用onResolved
    // 因为考虑到有可能throw，所以我们将其包在try/catch块里
    return promise2 = new _Promise(function(resolve, reject) {
      try {
        var x = onResolved(self.data)
        resolvePromise(promise2, x, resolve, reject)
      } catch (e) {
        reject(e) // 如果出错，以捕获到的错误做为promise2的结果
      }
    })
  }

  // 此处与前一个if块的逻辑几乎相同，区别在于所调用的是onRejected函数，就不再做过多解释
  if (self.status === 'rejected') {
    return promise2 = new _Promise(function(resolve, reject) {
      try {
        var x = onRejected(self.data)
        resolvePromise(promise2, x, resolve, reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  if (self.status === 'pending') {
  // 如果当前的Promise还处于pending状态，我们并不能确定调用onResolved还是onRejected，
  // 只能等到Promise的状态确定后，才能确实如何处理。
  // 所以我们需要把我们的**两种情况**的处理逻辑做为callback放入promise1(此处即this/self)的回调数组里
  // 逻辑本身跟第一个if块内的几乎一致，此处不做过多解释
    return promise2 = new _Promise(function(resolve, reject) {
      self.onResolvedCallback.push(function(value) {
        try {
          var x = onResolved(self.data)
          resolvePromise(promise2, x, resolve, reject)
        } catch (e) {
          reject(e)
        }
      })

      self.onRejectedCallback.push(function(reason) {
        try {
          var x = onRejected(self.data)
          resolvePromise(promise2, x, resolve, reject)
        } catch (e) {
          reject(e)
        }
      })
    })
  }
}

// 为了下文方便，我们顺便实现一个catch方法
_Promise.prototype.catch = function(onRejected) {
  return this.then(null, onRejected)
}

/*
then返回的promise2的状态和值，由then注册的onResolved的返回值x决定
如果x为普通值，直接调用promise2内部的resolve将x的值绑定到promise2上
如果x是promise对象或thenable对象，调用then,然后将promise2中的resolve和reject注册为onResolved和onRejected。
 */
function resolvePromise(promise2, x, resolve, reject) {
  var then
  var thenCalledOrThrow = false

  // 判断promise2是否引用x
  if (promise2 === x) return reject(new TypeError('Circular reference'))

  // x为_Promise对象
  if (x instanceof _Promise) {
    /**
     * x的状态为pending，此时x的值不确定，有可能还是promise对象所以调用x的then方法
     * 将x，resolve后的值value再次传入resolvePromise
     */
    if (x.status === 'pending') {
      x.then(function (value) {
        resolvePromise(promise2, value, resolve, reject)
      }, reject)
    // x的状态不为pending时，此时x的value已经确定，直接调用promise2的resolve或reject，将value绑定到promise2的value上。
    } else {
      x.then(resolve, reject)
    }

    return
  }

  /**
   * x 有可能是一个thenable对象
   * 首先判断x是否是一个对象
   */
  if ((x !== null) && ((typeof x === 'object') || (typeof x === 'function'))) {
    try {
      /**
       * 判断then是一个函数还是一个取值器
       * 如果then是函数，将thenCalledOrThrow置为true，并将rs推入到x的onResolvedCallback，rj推入到x的onRejectedCallback。
       */
      then = x.then
      if (typeof then === 'function') {
        then.call(x, function rs(y) {
          if (thenCalledOrThrow) return
          thenCalledOrThrow = true
          //因为此时还是不确定y是什么类型的值，所以再次传入resolvePromise
          return resolvePromise(promise2, y, resolve, reject)
        }, function rj(r) {
          if (thenCalledOrThrow) return
          thenCalledOrThrow = true
          return reject(r)
        })
      // then不是函数，那么就是取值器，直接将x绑定到promise2的value属性上.
      } else {
        resolve(x)
      }
      // 调用then过程中出错，直接reject
    } catch(e) {
      if (thenCalledOrThrow) return
      thenCalledOrThrow = true
      return reject(e)
    }

    return
  }

  // x 既不是_Promise对象，也不是thenable对象，直接将x绑定到promise2的value属性上。
  resolve(x)
}

var pro1 = new _Promise(function (res, rej) {
  var pro = new _Promise(function (res, rej) {
    setTimeout(function () {
      res(1)
    }, 1000)
  })
  pro.index = 1
  res(pro)
})
pro1.index = 0

// pro1.then(function (value) {
//   console.log(value);
// })
pro1.then(function (value) {
  return new _Promise(function (res, rej) {
    setTimeout(function () {
      res(value + 1)
    }, 1000)
  })
}).then(function (value) {
  console.log(value);
})
