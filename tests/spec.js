(function($Catwalk) {

    var catwalk    = new $Catwalk(),
        collection = {},
        models     = {};

    beforeEach(function beforeEach() {

        // Define the "cats" collection.
        collection = catwalk.createCollection('cats', {
            name: catwalk.typecast.string()
        });

        models.first  = collection.addModel({ name: 'Kipper' });
        models.second = collection.addModel({ name: 'Splodge' });
        models.third  = collection.addModel({ name: 'Mango' });
        models.fourth = collection.addModel({ name: 'Miss Kittens' });
        models.fifth  = collection.addModel({ name: 'Tinker' });


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
                var superfluousModel = collection.addModel({ name: 'Molly', location: 'London' });
                expect(superfluousModel.name).toEqual('Molly');
                expect(superfluousModel.location).toBeUndefined();
            });

            it('Should be able to typecast properties and set defaults;', function() {

                var typecastModel = collection.addModel({ name: 7 });
                expect(typeof typecastModel.name).toEqual('string');
                expect(typecastModel.name).toEqual('7');

                var defaultModel = collection.addModel();
                expect(defaultModel.name).toBeDefined();
                expect(typeof defaultModel.name).toEqual('string');
                expect(defaultModel.name).toEqual('');

            });

        });

    });

})(window.Catwalk);