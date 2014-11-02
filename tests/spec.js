(function($Catwalk) {

    var catwalk    = new $Catwalk(),
        collection = {},
        models     = {};

    beforeEach(function beforeEach() {

        // Define the "cats" collection.
        collection = catwalk.createCollection('cats', {
            name: catwalk.typecast.string(),
            age:  catwalk.typecast.number(),
            isKitten: catwalk.typecast.custom(function custom(value) {
                return !!value;
            })
        });

        models.first  = collection.createModel({ name: 'Kipper' });
        models.second = collection.createModel({ name: 'Splodge' });
        models.third  = collection.createModel({ name: 'Mango' });
        models.fourth = collection.createModel({ name: 'Miss Kittens' });
        models.fifth  = collection.createModel({ name: 'Tinker', age: 15 });


    });

    describe('Catwalk', function Catwalk() {

        it('Should be able to define Catwalk module;', function() {
            expect($Catwalk).toBeDefined();
            expect($Catwalk.Collection).toBeDefined();
        });

        describe('Collections', function Collections() {

            it('Should be able to create a collection;', function() {
                expect(collection instanceof $Catwalk.Collection);
                expect(collection.name).toEqual('cats');
                expect(collection.blueprint.name).toBeDefined();
            });

            it('Should be able to hook up the Utility class;', function() {
                expect(collection.utility instanceof $Catwalk.Utility).toBeTruthy();
            });

            it('Should throw an exception when the collection name is empty;', function() {

                expect(function() {
                    catwalk.createCollection();
                }).toThrow('Catwalk.js: You must specify a name for the collection.');

            });

            it('Should be able to return the collection name using the factor;', function() {
                expect(catwalk.collection('cats')).toEqual(collection);
            });

            it('Should be able to add models that are immutable;', function() {
                expect(models.first.name).toEqual('Kipper');
                models.first.name = 'Bob';
                expect(models.first.name).toEqual('Kipper');
                expect(Object.isFrozen(models.first)).toBeTruthy();
                expect(Object.isFrozen(models.fifth)).toBeTruthy();
            });

            it('Should be able to assign a unique ID to the model;', function() {
                expect(models.first.__catwalkId).toEqual(1);
                expect(models.second.__catwalkId).toEqual(2);
                expect(models.third.__catwalkId).toEqual(3);
            });

            it('Should be able to delete and clear models;', function() {
                expect(collection.models.length).toEqual(5);
                collection.deleteModel(models.first);
                expect(collection.models.length).toEqual(4);
                collection.clearModels();
                expect(collection.models.length).toEqual(0);
            });

            it('Should be able to iterate over the models using generators;', function() {

                expect(collection.getModels).toBeDefined();
                var modelGenerator = collection.getModels();
                expect(typeof modelGenerator.next).toBe('function');

                var firstYield = modelGenerator.next();
                expect(firstYield.done).toEqual(false);
                expect(firstYield.value).toEqual(models.first);

                var secondYield = modelGenerator.next();
                expect(secondYield.done).toEqual(false);
                expect(secondYield.value).toEqual(models.second);

                modelGenerator.next();
                modelGenerator.next();
                modelGenerator.next();
                var lastYield = modelGenerator.next();
                expect(lastYield.done).toEqual(true);
                expect(lastYield.value).toBeUndefined();

            });

            it('Should be able to remove superfluous properties that are not in the blueprint;', function() {
                var superfluousModel = collection.createModel({ name: 'Molly', location: 'London' });
                expect(superfluousModel.name).toEqual('Molly');
                expect(superfluousModel.location).toBeUndefined();
            });

            it('Should be able to typecast properties and set defaults;', function() {

                var typecastModelString = collection.createModel({ name: 7 });
                expect(typeof typecastModelString.name).toEqual('string');
                expect(typecastModelString.name).toEqual('7');

                var typecastModelNumber = collection.createModel({ name: 'Kipper', age: '17' });
                expect(typeof typecastModelNumber.age).toEqual('number');
                expect(typecastModelNumber.age).toEqual(17);

            });

            it('Should be able to add a custom typecast function;', function() {
                var typecastModelCustom = collection.createModel({ name: 'Tinker', isKitten: 0 });
                expect(typeof typecastModelCustom.isKitten).toBe('boolean');
                expect(typecastModelCustom.isKitten === false).toBeTruthy();
            });

            it('Should be able to update a model and retain its internal ID;', function() {
                var fifthModelUpdated = collection.updateModel(models.fifth, { name: 'Little Tinker', superfluous: 'Pfft!' });
                expect(collection.models.length).toEqual(5);
                expect(fifthModelUpdated.name).toEqual('Little Tinker');
                expect(fifthModelUpdated.superfluous).toBeUndefined();
                expect(fifthModelUpdated.age).toEqual(15);
                expect(Object.isFrozen(fifthModelUpdated)).toBeTruthy();
                expect(fifthModelUpdated.__catwalkId).toEqual(models.fifth.__catwalkId);
            });

        });

    });

})(window.Catwalk);