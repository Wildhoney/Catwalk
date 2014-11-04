(function(Catwalk) {

    "use strict";

    /**
     * @class CatwalkResolution
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class CatwalkResolution {

        /**
         * @constructor
         * @return {CatwalkResolution}
         */
        constructor() {

            var defaultResolveReject = (promise, newModel) => promise.resolve(newModel);

            this.events = {
                create: defaultResolveReject,
                update: defaultResolveReject,
                delete: defaultResolveReject
            };

        }

        /**
         * @method createPromise
         * @param actionType {String}
         * @param {Object|null} [newModel=null] - Model that should be created if the promise has been resolved.
         * @param {Object|null} [oldModel=null] - Model that should be reverted to if the promise has been rejected.
         * @return {void}
         */
        createPromise(actionType, newModel = null, oldModel = null) {

            var promise = new Promise((resolve, reject) => {

                this.events[actionType]({ resolve: resolve, reject: reject }, newModel, oldModel);

            });

            promise.then((newModel) => {

                newModel[Catwalk.PRIVATE].status = Catwalk.STATUS.RESOLVED;

            }, () => {



            });

        }

        /**
         * @method on
         * @param name {String}
         * @param eventFn {Function}
         * @return {void}
         */
        on(name, eventFn) {
            this.events[name] = eventFn;
        }

    }

    // Expose the `Catwalk.Resolution` property.
    Catwalk.Resolution = CatwalkResolution;

})(window.Catwalk);