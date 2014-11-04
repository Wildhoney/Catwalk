(function($window, catwalk) {

    var collection  = {},
        models      = {},
        catwalkMeta = '__catwalk';

    beforeEach(function beforeEach() {


        // Define the "cats" collection.
        collection = catwalk.createCollection('cats', {
            id: 0,
            name: '',
            age: 0,
            colours: catwalk.relationship.hasMany('colour', 'colours')
        });

        models.first  = collection.createModel({ name: 'Kipper' });
        models.second = collection.createModel({ name: 'Splodge' });
        models.third  = collection.createModel({ name: 'Mango' });
        models.fourth = collection.createModel({ name: 'Miss Kittens' });
        models.fifth  = collection.createModel({ name: 'Tinker', age: 15 });
        models.sixth  = collection.createModel({ name: 'Busters', age: 4 });

        // Ensure all of the models are sealed!
        Object.keys(models).forEach(function forEach(property) {
            expect(Object.isSealed(models[property])).toBeTruthy();
        });

        /**
         * @class Promise
         * @param setupFn {Function}
         * @constructor
         */
        $window.Promise = function PromiseMock(setupFn) {

            var status    = 0,
                params    = [],
                successFn = function() { params = arguments; status = 1; },
                errorFn   = function() { params = arguments; status = 2; };

            setupFn(successFn, errorFn);

            /**
             * @method then
             * @param successFn {Function}
             * @param errorFn {Function}
             * @return {void}
             */
            this.then = function then(successFn, errorFn) {

                if (status === 1) {
                    successFn.apply(null, params);
                    return;
                }

                errorFn.apply(null, params);

            }

        };

    });

    afterEach(function afterEach() {

        catwalk.events      = {};
        catwalk.collections = {};

    });

    describe('Catwalk', function Catwalk() {

        it('Should be able to define Catwalk module;', function() {
            expect(catwalk).toBeDefined();
            expect(catwalk.createCollection).toBeDefined();
        });

        describe('Collection', function() {

            beforeEach(function() {
                expect(collection.blueprint).toBeDefined();
                expect(Object.isFrozen(collection.blueprint.model)).toBeTruthy();
                spyOn(collection, 'conditionallyEmitEvent').andCallThrough();
            });

            afterEach(function() {
                expect(collection.conditionallyEmitEvent).toHaveBeenCalled();
            });

            describe('Create', function() {

                it('Should be able to add a model;', function() {

                    var model = collection.createModel({ name: 'Moose' });
                    expect(model.name).toEqual('Moose');
                    expect(collection.models.length).toEqual(7);

                    // Model meta-data.
                    expect(model[catwalkMeta]).toBeDefined();
                    expect(model[catwalkMeta].id).toEqual(7);
                    expect(model[catwalkMeta].status).toEqual(1);
                    collection.conditionallyEmitEvent();

                });

                it('Should be able to add required properties;', function() {
                    var model = collection.createModel({ name: 'Charlie' });
                    expect(model.name).toEqual('Charlie');
                    expect(model.age).toBeDefined();
                    collection.conditionallyEmitEvent();
                });

                it('Should be able to remove superfluous properties;', function() {
                    var model = collection.createModel({ name: 'Moose', lives: 'Manchester' });
                    expect(model.name).toEqual('Moose');
                    expect(model.lives).toBeUndefined();
                    collection.conditionallyEmitEvent();
                });

                it('Should be able to add a model and resolve the promise;', function() {

                    catwalk.on('create', function(collectionName, model, promise) {
                        expect(collectionName).toEqual('cats');
                        expect(model[catwalkMeta]).toBeUndefined();
                        promise.resolve();
                    });

                    var model = collection.createModel({ name: 'Charlie', age: 7 });
                    expect(collection.models.length).toEqual(7);
                    expect(model[catwalkMeta].status).toEqual(4);

                });

                it('Should be able to add a model and resolve the promise and modify the properties;', function() {

                    catwalk.on('create', function(collectionName, model, promise) {
                        expect(collectionName).toEqual('cats');
                        expect(model[catwalkMeta]).toBeUndefined();
                        promise.resolve({ id: 6, age: 9 });
                    });

                    var model = collection.createModel({ name: 'Moose', age: 8 });
                    expect(collection.models.length).toEqual(7);
                    expect(model[catwalkMeta].status).toEqual(4);
                    expect(model.name).toEqual('Moose');
                    expect(model.id).toEqual(6);
                    expect(model.age).toEqual(9);

                });

                it('Should be able to add a model and reject the promise;', function() {

                    catwalk.on('create', function(collectionName, model, promise) {
                        expect(model[catwalkMeta]).toBeUndefined();
                        promise.reject();
                    });

                    // Ensure the delete callback isn't invoked when the user rejects the creation
                    // of a model!
                    var Mock = { Delete: function() {} };
                    catwalk.on('delete', Mock.Delete);
                    spyOn(Mock, 'Delete');

                    var model = collection.createModel({ name: 'Charlie', age: 7 });
                    expect(collection.models.length).toEqual(6);
                    expect(model[catwalkMeta].status).toEqual(8);
                    expect(Mock.Delete).not.toHaveBeenCalled();

                });

                it('Should be able to add a model and reject the promise in favour of a duplicate model;', function() {

                    catwalk.on('create', function(collectionName, model, promise) {
                        expect(model[catwalkMeta]).toBeUndefined();
                        promise.reject(models.first);
                    });

                    var model = collection.createModel({ name: 'Charlie', age: 7 });
                    expect(collection.models.length).toEqual(6);
                    expect(model.name).toEqual('Kipper');

                    collection.deleteModel(model);
                    expect(collection.models.length).toEqual(5);

                    // Idempotent?
                    collection.deleteModel(model);
                    expect(collection.models.length).toEqual(5);

                    var updatedModel = collection.updateModel(model, { name: 'Bob' });
                    expect(model.name).toEqual('Bob');
                    expect(model === updatedModel).toBeTruthy();

                });

            });

            describe('Update', function() {

                it('Should be able to update a model;', function() {

                    var updatedModel = collection.updateModel(models.first, { name: 'Jeremy', lives: 'London' });
                    expect(updatedModel.name).toEqual('Jeremy');
                    expect(updatedModel.lives).toBeUndefined();
                    expect(updatedModel.age).toBeDefined();
                    expect(updatedModel === models.first).toBeTruthy();
                    expect(collection.models.length).toEqual(6);
                    collection.conditionallyEmitEvent();

                });

                it('Should be able to update a model and then resolve the promise;', function() {

                    catwalk.on('update', function(collectionName, model, promise) {
                        promise.resolve();
                    });

                    var model = collection.createModel({ name: 'Boris' });
                    expect(model.name).toEqual('Boris');
                    var updatedModel = collection.updateModel(model, { name: 'Carla' });
                    expect(model === updatedModel).toBeTruthy();
                    expect(updatedModel.name).toEqual('Carla');
                    expect(collection.models.length).toEqual(7);

                });

                it('Should be able to update a model and then resolve the promise with additional properties;', function() {

                    catwalk.on('update', function(collectionName, model, promise) {
                        promise.resolve({ id: 25, name: 'Lara' });
                    });

                    expect(models.first.id).not.toEqual(25);
                    expect(models.first.name).toEqual('Kipper');
                    var updatedModel = collection.updateModel(models.first);

                    expect(updatedModel.id).toEqual(25);
                    expect(updatedModel.name).toEqual('Lara');
                    expect(updatedModel === models.first);

                });

                it('Should be able to update a model and then reject the promise;', function() {

                    catwalk.on('update', function(collectionName, model, promise) {
                        promise.reject();
                    });

                    var model = collection.createModel({ name: 'Boris' });
                    expect(model.name).toEqual('Boris');
                    var updatedModel = collection.updateModel(model, { name: 'Carla' });
                    expect(model === updatedModel).toBeTruthy();
                    expect(updatedModel.name).toEqual('Boris');
                    expect(collection.models.length).toEqual(7);

                    var anotherUpdatedModel = collection.updateModel(model, { age: 17 });
                    expect(anotherUpdatedModel.age).not.toEqual(17);

                    collection.deleteModel(updatedModel);
                    expect(collection.models.length).toEqual(6);

                });

                it('Should be able to update a model and then reject the promise in favour of a duplicate model;', function() {

                    catwalk.on('update', function(collectionName, model, promise) {
                        promise.reject(models.second);
                    });

                    expect(collection.models.length).toEqual(6);
                    var updatedModel = collection.updateModel(models.first);
                    expect(updatedModel.name).toEqual('Splodge');
                    expect(updatedModel === models.first);
                    expect(collection.models.length).toEqual(5);
                    expect(updatedModel[catwalkMeta].status).toEqual(4);

                });

            });

            describe('Delete', function() {

                it('Should be able to delete a model;', function() {

                    expect(collection.models.length).toEqual(6);
                    var model = collection.deleteModel(models.third);
                    expect(model === models.third).toBeTruthy();
                    expect(collection.models.length).toEqual(5);
                    collection.conditionallyEmitEvent();

                });

                it('Should be able to delete a model and resolve the promise;', function() {

                    catwalk.on('delete', function(collectionName, model, promise) {
                        expect(collectionName).toEqual('cats');
                        expect(model[catwalkMeta]).toBeUndefined();
                        promise.resolve();
                    });

                    var model = collection.deleteModel(models.fifth);
                    expect(model[catwalkMeta].status).toEqual(8);
                    expect(collection.models.length).toEqual(5);

                });

                it('Should be able to delete a model and reject the promise;', function() {

                    catwalk.on('delete', function(collectionName, model, promise) {
                        expect(collectionName).toEqual('cats');
                        expect(model[catwalkMeta]).toBeUndefined();
                        promise.reject();
                    });

                    var model = collection.deleteModel(models.third);
                    expect(model[catwalkMeta].status).toEqual(1);
                    expect(collection.models.length).toEqual(6);

                });

            });

        });

        describe('Relationship', function() {

            beforeEach(function() {

                models.seventh = collection.createModel({
                    name: 'Lucy',
                    colours: ['black', 'white', 'ginger', 'grey']
                });

            });

            it('Should be able to define the relationship;', function() {

                expect(models.seventh.colours).toBeDefined();

            });

        });

    });

})(window, window.catwalk);