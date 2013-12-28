(function($catwalk) {

    "use strict";

    /**
     * @property _resolve
     * @type {Object}
     */
    var _resolve = function defaultResolve(collection, deferred) { deferred.resolve(); };

    $catwalk.event = {

        /**
         * @property _events
         * @type {Object}
         * @protected
         */
        _events: {
            create: _resolve,
            read:   _resolve,
            update: _resolve,
            delete: _resolve
        },

        /**
         * @method on
         * @param namespace {String}
         * @param callback {Function}
         * @return {void}
         */
        on: function on(namespace, callback) {
            this._events[namespace] = callback;
        },

        /**
         * @method broadcastRead
         * @param type {String}
         * @param collection {Object}
         * @param deferred {Object}
         * @param property {String}
         * @param value {String}
         * @return {void}
         */
        broadcastRead: function broadcastRead(type, collection, deferred, property, value) {
            var eventName = type + '/' + collection._name;
            this._getCallback(eventName, type).call($catwalk, collection._name, deferred, property, value);
        },

        /**
         * @method broadcastOthers
         * @param type {String}
         * @param collection {Object}
         * @param deferred {Object}
         * @param model {Object}
         * @return {void}
         */
        broadcastOthers: function broadcastOthers(type, collection, deferred, model) {
            var eventName = type + '/' + collection._name;
            this._getCallback(eventName, type).call($catwalk, collection._name, deferred, model);
        },

        /**
         * @method _getCallback
         * @param specificCallbackPath {String}
         * @param generalCallbackPath {String}
         * @return {Function}
         * @private
         */
        _getCallback: function _getPath(specificCallbackPath, generalCallbackPath) {

            if (_.contains(_.keys(this._events), specificCallbackPath)) {
                return this._events[specificCallbackPath];
            }

            return this._events[generalCallbackPath];

        }

    };

})(window.catwalk);