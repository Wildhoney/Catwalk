(function($window, catwalk) {

    var collection  = {},
        models      = {},
        catwalkMeta = '__catwalk';

    beforeEach(function beforeEach() {

        // Define the "cats" collection.
        collection = catwalk.createCollection('cats', {
            id: 0,
            name: 'None',
            age: 0,
            colours: catwalk.relationship.hasMany('name', 'colours'),
            primeColour: catwalk.relationship.hasOne('name', 'colours')
        });

        // Create mock colour collection.
        catwalk.createCollection('colours', {});

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

        it('Should be able to add and then remove an event;', function() {

            expect(catwalk.events.create).toBeUndefined();
            catwalk.on('create', function() {});
            expect(catwalk.events.create).toBeDefined();

            expect(catwalk.events.delete).toBeUndefined();
            catwalk.off('delete');
            expect(catwalk.events.delete).toBeUndefined();
            expect(catwalk.events.create).toBeDefined();

            catwalk.off('create');
            expect(catwalk.events.create).toBeUndefined();

        });

        it('Should be able to expose the `STATES` constant on the `catwalk` object;', function() {
            expect(catwalk.STATES).toBeDefined();
            expect(typeof catwalk.STATES).toBe('object');
            expect(catwalk.STATES.NEW).toEqual(1);
            expect(catwalk.STATES.DIRTY).toEqual(2);
            expect(catwalk.STATES.SAVED).toEqual(4);
            expect(catwalk.STATES.DELETED).toEqual(8);
        });

        describe('Collection', function() {

            it('Should be able to return the collection using the factory method;', function() {
                expect(typeof catwalk.collection('cats')).toBe('object');
            });

            it('Should be able to throw an exception when the collection name is invalid;', function() {
                expect(function() { catwalk.collection('dogs'); }).toThrow('Catwalk: Unable to find collection "dogs".');
            });

            it('Should be able to delete existing collections;', function() {
                var transientCollection = catwalk.createCollection('transient', { name: '' });
                expect(typeof transientCollection).toBe('object');
                expect(typeof catwalk.collection('transient')).toBe('object');
                catwalk.deleteCollection('transient');
                expect(function() {
                    catwalk.collection('transient');
                }).toThrow('Catwalk: Unable to find collection "transient".');
            });

            it('Should be able to reject collections without any blueprint properties;', function() {

                expect(function() {
                    catwalk.createCollection('no-properties');
                }).toThrow('Catwalk: Collection "no-properties" must define its blueprint.');

                expect(function() {
                    catwalk.collection('no-properties');
                }).toThrow('Catwalk: Unable to find collection "no-properties".');

            });

            describe('Typecast', function() {

                var dogCollection;

                beforeEach(function() {

                    dogCollection = catwalk.createCollection('dogs', {
                        id: catwalk.typecast.autoIncrement(),
                        name: catwalk.typecast.string('None'),
                        ident: catwalk.typecast.custom(function(value) {
                            return (value || '').replace(/\s+/ig, '-').toLowerCase();
                        }),
                        age: catwalk.typecast.number(5),
                        hasOwner: catwalk.typecast.boolean(true)
                    });

                });

                it('Should be able to typecast a model from number to string;', function() {
                    var model = dogCollection.createModel({ name: 7 });
                    expect(model.name).toEqual('7');
                    expect(model.hasOwner).toEqual(true);
                });

                it('Should be able to add a model and fill in the defaults;', function() {
                    var model = dogCollection.createModel();
                    expect(model.name).toEqual('None');
                    expect(model.age).toEqual(5);
                });

                it('Should be able a model and typecast as an autoIncrement', function() {
                    var firstModel = dogCollection.createModel();
                    expect(firstModel.id).toEqual(1);
                    var secondModel = dogCollection.createModel();
                    expect(secondModel.id).toEqual(2);
                });

                it('Should be able to add a model and fill in the missing defaults;', function() {
                    var model = dogCollection.createModel({ name: 'Rex', hasOwner: false });
                    expect(model.name).toEqual('Rex');
                    expect(model.age).toEqual(5);
                    expect(model.hasOwner).toEqual(false);
                });

                it('Should be able to define its own custom typecast method;', function() {
                    var model = dogCollection.createModel({ ident: 'Snow White' });
                    expect(model.ident).toEqual('snow-white');
                });

                it('Should be able to reverse the typecast for persisting the model;', function() {

                    catwalk.on('create', function(model, promise) {
                        expect(model.name).toEqual(11);
                        expect(model.age).toEqual('5');
                        promise.resolve();
                    });

                    var model = dogCollection.createModel({ name: 11, age: '5' });
                    expect(model.name).toEqual('11');
                    expect(model.age).toEqual(5);

                });

                it('Should be able to reverse custom typecasts on callback invocation unless option defined;', function() {

                    catwalk.on('create', function(model, promise) {
                        expect(model.name).toEqual('Lindsey');
                        expect(model.age).toEqual(7);
                        expect(model.ident).toEqual('Lindsey');
                        promise.resolve();
                    });

                    var model = dogCollection.createModel({ name: 'Lindsey', ident: 'Lindsey', age: 7 });
                    expect(model.name).toEqual('Lindsey');
                    expect(model.age).toEqual(7);
                    expect(model.ident).toEqual('lindsey');

                    // Disable the inverse-typecasting of properties!
                    catwalk.revertCallbackTypecast(false);

                    catwalk.on('create', function(model, promise) {
                        expect(model.name).toEqual('Lindsey');
                        expect(model.age).toEqual(7);
                        expect(model.ident).toEqual('lindsey');
                        promise.resolve();
                    });

                    model = dogCollection.createModel({ name: 'Lindsey', ident: 'Lindsey', age: 7 });
                    expect(model.name).toEqual('Lindsey');
                    expect(model.age).toEqual(7);
                    expect(model.ident).toEqual('lindsey');

                });

            });

            describe('CRUD Methods', function() {

                describe('Create', function() {

                    beforeEach(function() {
                        expect(collection.blueprint).toBeDefined();
                        expect(Object.isFrozen(collection.blueprint.model)).toBeTruthy();
                        spyOn(collection, 'conditionallyEmitEvent').andCallThrough();
                    });

                    afterEach(function() {
                        expect(collection.conditionallyEmitEvent).toHaveBeenCalled();
                    });

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

                    it('Should be able to add a model with a default value;', function() {
                        var model = collection.createModel({ age: 12 });
                        expect(model.name).toEqual('None');
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

                        catwalk.on('create', function(model, promise) {
                            expect(this.name).toEqual('cats');
                            expect(model[catwalkMeta]).toBeUndefined();
                            promise.resolve();
                        });

                        var model = collection.createModel({ name: 'Charlie', age: 7 });
                        expect(collection.models.length).toEqual(7);
                        expect(model[catwalkMeta].status).toEqual(4);

                    });

                    it('Should be able to add a model and resolve the promise and modify the properties;', function() {

                        catwalk.on('create', function(model, promise) {
                            expect(this.name).toEqual('cats');
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

                        catwalk.on('create', function(model, promise) {
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

                        catwalk.on('create', function(model, promise) {
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

                describe('Read', function() {

                    it('Should be able to load a model into the collection by promise resolution;', function() {

                        catwalk.on('read', function(model, promise) {
                            promise.resolve({ id: 10, name: 'Ellie' });
                        });

                        var model = collection.readModel({ id: 10 });
                        expect(collection.models.length).toEqual(7);
                        expect(model.id).toEqual(10);
                        expect(model.name).toEqual('Ellie');

                    });

                    it('Should be able to load a model into the collection by promise rejection;', function() {

                        catwalk.on('read', function(model, promise) {
                            promise.reject();
                        });

                        collection.readModel({ id: 10 });
                        expect(collection.models.length).toEqual(6);

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

                        catwalk.on('update', function(model, promise) {
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

                        catwalk.on('update', function(model, promise) {
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

                        catwalk.on('update', function(model, promise) {
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

                        catwalk.on('update', function(model, promise) {
                            promise.reject(models.second);
                        });

                        expect(collection.models.length).toEqual(6);
                        var updatedModel = collection.updateModel(models.first);
                        expect(updatedModel.name).toEqual('Splodge');
                        expect(updatedModel === models.first);
                        expect(collection.models.length).toEqual(5);
                        expect(updatedModel[catwalkMeta].status).toEqual(4);

                    });

                    it('Should be able to typecast any updated properties;', function() {

                        var dogCollection = catwalk.createCollection('dogs', {
                            name: catwalk.typecast.string()
                        });

                        var model = dogCollection.createModel({ name: 'Terrance' });
                        expect(model.name).toEqual('Terrance');

                        model = dogCollection.updateModel(models.sixth, { name: 7 });
                        expect(model.name).toEqual('7');

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

                        catwalk.on('delete', function(model, promise) {
                            expect(this.name).toEqual('cats');
                            expect(model[catwalkMeta]).toBeUndefined();
                            promise.resolve();
                        });

                        var model = collection.deleteModel(models.fifth);
                        expect(model[catwalkMeta].status).toEqual(8);
                        expect(collection.models.length).toEqual(5);

                    });

                    it('Should be able to delete a model and reject the promise;', function() {

                        catwalk.on('delete', function(model, promise) {
                            expect(this.name).toEqual('cats');
                            expect(model[catwalkMeta]).toBeUndefined();
                            promise.reject();
                        });

                        var model = collection.deleteModel(models.third);
                        expect(model[catwalkMeta].status).toEqual(1);
                        expect(collection.models.length).toEqual(6);

                    });

                });

            });

        });

        describe('Relationship', function() {

            var colourCollection, colourModels = {};

            beforeEach(function() {

                colourCollection = catwalk.createCollection('colours', {
                    name: catwalk.typecast.string()
                });

                colourModels.first  = colourCollection.createModel({ name: 'Black' });
                colourModels.second = colourCollection.createModel({ name: 'White' });

                models.seventh = collection.createModel({
                    name: 'Lucy',
                    colours: ['Black', 'White'],
                    primeColour: 'White'
                });

            });

            it('Should be able to reverse the relationships when invoking the callbacks;', function() {

                catwalk.on('update', function(model, promise) {
                    expect(model.colours[0]).toEqual('Black');
                    expect(model.colours[1]).toEqual('White');
                    promise.resolve();
                });


                var model = collection.updateModel(models.seventh, { name: 'Ellis' });
                expect(model.colours.length).toEqual(2);
                expect(model.colours[0] === colourModels.first).toBeTruthy();
                expect(model.colours[1] === colourModels.second).toBeTruthy();

            });

            it('Should be able to add items to the hasMany relationship using `addAssociation`;', function() {

                var model = collection.createModel({ colours: ['Black'] });
                expect(model.colours.length).toEqual(1);

                expect(function() {
                    collection.addAssociation(model, 'name', ['White']);
                }).toThrow('Catwalk: Using `addAssociation` requires a hasMany relationship.');

                expect(model.colours.length).toEqual(1);
                collection.addAssociation(model, 'colours', ['White']);
                expect(model.colours.length).toEqual(2);

            });

            it('Should be able to add items to the hasMany relationship using `removeAssociation`;', function() {

                var model = collection.createModel({ colours: ['Black', 'White'] });
                expect(model.colours.length).toEqual(2);

                expect(function() {
                    collection.removeAssociation(model, 'name', ['White']);
                }).toThrow('Catwalk: Using `removeAssociation` requires a hasMany relationship.');

                expect(model.colours.length).toEqual(2);
                collection.removeAssociation(model, 'colours', ['Black']);
                expect(model.colours.length).toEqual(1);
                expect(model.colours[0].name).toEqual('White');

            });

            it('Should be able to define hasMany relationships as an array if unset in createModel;', function() {
                var model = collection.createModel({ name: 'Maria' });
                expect(Array.isArray(model.colours)).toBeTruthy();
                expect(model.colours.length).toEqual(0);
            });

            describe('Types', function() {

                describe('One-to-One', function() {

                    it('Should be able to fetch the model from a relationship;', function() {
                        expect(models.seventh.primeColour).toBeDefined();
                        expect(models.seventh.primeColour).toEqual(colourModels.second);
                        expect(models.seventh.primeColour.name).toEqual('White');
                    });

                    it('Should be able to modify the relationship and return the new model;', function() {
                        var model = collection.updateModel(models.seventh, { primeColour: 'Black' });
                        expect(model.primeColour.name).toEqual('Black');
                    });

                    it('Should be able to fetch a model that is currently unloaded;', function() {

                        catwalk.on('read', function(model, promise) {
                            expect(model.hasOwnProperty('name')).toBeTruthy();
                            promise.resolve({ name: 'Grey' });
                        });

                        expect(colourCollection.models.length).toEqual(2);
                        var model = collection.updateModel(models.seventh, { primeColour: 'Grey' });
                        expect(model.primeColour.name).toEqual('Grey');
                        expect(colourCollection.models.length).toEqual(3);

                    });

                });

                describe('Many-to-Many', function() {

                    it('Should be able to fetch the models from a relationship;', function() {
                        expect(models.seventh.colours).toBeDefined();
                        expect(models.seventh.colours.length).toEqual(2);
                        expect(models.seventh.colours[0]).toEqual(colourModels.first);
                        expect(models.seventh.colours[0].name).toEqual('Black');
                        expect(models.seventh.colours[1]).toEqual(colourModels.second);
                        expect(models.seventh.colours[1].name).toEqual('White');
                    });

                    it('Should be able to modify the relationship and return the new models;', function() {
                        var model = collection.updateModel(models.seventh, { colours: ['White'] });
                        expect(model === models.seventh).toBeTruthy();
                        expect(models.seventh.colours.length).toEqual(1);
                        expect(models.seventh.colours[0]).toEqual(colourModels.second);
                        expect(models.seventh.colours[0].name).toEqual('White');
                    });

                    it('Should be able to fetch the models that are currently unloaded;', function() {

                        catwalk.on('read', function(model, promise) {
                            expect(model.hasOwnProperty('name')).toBeTruthy();
                            promise.resolve({ name: model.name });
                        });

                        var model = collection.updateModel(models.seventh, { colours: ['White', 'Grey', 'Ginger'] });
                        expect(model === models.seventh).toBeTruthy();
                        expect(models.seventh.colours.length).toEqual(3);
                        expect(models.seventh.colours[0]).toEqual(colourModels.second);
                        expect(models.seventh.colours[0].name).toEqual('White');
                        expect(models.seventh.colours[1].name).toEqual('Grey');
                        expect(models.seventh.colours[2].name).toEqual('Ginger');

                    });

                });

            });

        });

        describe('Strategies', function() {

            var fruitCollection, colourCollection;

            beforeEach(function() {

                // Create the fruit collection.
                fruitCollection = catwalk.createCollection('fruit', {
                    name: catwalk.typecast.string(),
                    colours: catwalk.relationship.hasMany('name', 'colour')
                });

                // ...And create the colour collection.
                colourCollection = catwalk.createCollection('colour', {
                    id: catwalk.typecast.number(),
                    name: catwalk.typecast.string()
                });

            });

            it('Should be able to create, update, and delete, as well as modify relationships;', function() {

                var appleModel  = fruitCollection.createModel({ name: 'Apple', colours: ['Green', 'Red'] }),
                    bananaModel = fruitCollection.createModel({ name: 'Banana', colours: ['Yellow'] }),
                    greenModel  = colourCollection.createModel({ id: 1, name: 'Green' }),
                    redModel    = colourCollection.createModel({ id: 2, name: 'Red' }),
                    yellowModel = colourCollection.createModel({ id: 3, name: 'Yellow' });

                expect(appleModel.name).toEqual('Apple');
                expect(bananaModel.colours[0].name).toEqual('Yellow');
                expect(appleModel.colours[0].name).toEqual('Green');
                expect(appleModel.colours.length).toEqual(2);

                colourCollection.deleteModel(redModel);
                expect(appleModel.colours.length).toEqual(1);
                expect(redModel[catwalkMeta].status).toEqual(1);

                colourCollection.updateModel(yellowModel, { id: 4 });
                expect(bananaModel.colours.length).toEqual(1);
                colourCollection.updateModel(yellowModel, { name: 'Orange' });
                expect(bananaModel.colours.length).toEqual(0);

                expect(appleModel.colours.length).toEqual(1);
                expect(greenModel.name).toEqual('Green');
                colourCollection.updateModel(greenModel, { name: 'green' });
                expect(appleModel.colours.length).toEqual(0);

            });

        });

    });

})(window, window.catwalk);