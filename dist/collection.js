module.exports=function(e){function n(r){if(t[r])return t[r].exports;var o=t[r]={exports:{},id:r,loaded:!1};return e[r].call(o.exports,o,o.exports,n),o.loaded=!0,o.exports}var t={};return n.m=e,n.c=t,n.p="",n(0)}([function(e,n,t){e.exports=t(2)},function(e,n){"use strict";function t(e){var n=arguments.length<=1||void 0===arguments[1]?0:arguments[1];return{cast:e,options:n}}Object.defineProperty(n,"__esModule",{value:!0}),n.field=t;var r={PRIMARY_KEY:1};n.option=r;var o={string:function(){return function(e){return String(null==e?"":e)}},integer:function(){return function(e){var n=parseInt(e);return isNaN(n)?0:n}},"float":function(){var e=arguments.length<=0||void 0===arguments[0]?0:arguments[0];return function(n){var t=Math.pow(10,e),r=Math.round((t*n).toFixed(e))/t;return isNaN(r)?0:r}}};n.cast=o},function(e,n,t){"use strict";function r(e,n){if(!(e instanceof n))throw new TypeError("Cannot call a class as a function")}function o(){return l.size}function u(e){return"undefined"==typeof e?p.get(f):void p.set(f,e)}function i(e,n){return new d(e,n)}Object.defineProperty(n,"__esModule",{value:!0});var a=function(){function e(e,n){for(var t=0;t<n.length;t++){var r=n[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}return function(n,t,r){return t&&e(n.prototype,t),r&&e(n,r),n}}();n.size=o,n.subscribe=u,n.create=i;var c=t(4),s=t(3),f="updated",l=new Map,p=(new Map).set(f,function(){}),d=function(){function e(n,t){r(this,e),!(0,s.hasPrimaryKey)(t)&&(0,c.throwException)('Must define a PK on "'+n+'" collection'),l.set(this,{name:n,properties:t})}return a(e,[{key:"create",value:function(e){}},{key:"update",value:function(e,n){}},{key:"read",value:function(e){}},{key:"delete",value:function(e){}}]),e}()},function(e,n,t){"use strict";function r(e){return Object.keys(e).some(function(n){return e[n].options&o.option.PRIMARY_KEY})}Object.defineProperty(n,"__esModule",{value:!0}),n.hasPrimaryKey=r;var o=t(1)},function(e,n){"use strict";function t(e){throw new Error("Catwalk: "+e+".")}Object.defineProperty(n,"__esModule",{value:!0}),n.throwException=t}]);