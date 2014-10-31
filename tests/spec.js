(function($Catwalk) {

    var catwalk = new $Catwalk();

    describe('Catwalk', function Catwalk() {

        it('Should be able to define Catwalk module;', function() {
            expect($Catwalk).toBeDefined();
            expect($Catwalk.Collection).toBeDefined();
        });

        describe('Collections', function Collections() {

            it('Should be able to create a collection;', function() {

                var collection = catwalk.createCollection('cats', {
                    name: ''
                });

                expect(collection instanceof $Catwalk.Collection);
                expect(collection.name).toEqual('cats');
                expect(collection.properties.name).toBeDefined();

            });

            it('Should be able to add models that are immutable;', function() {

                var collection = catwalk.createCollection('cats', { name: '' }),
                    model      = collection.addModel({ name: 'Kipper' });

                expect(model.name).toEqual('Kipper');
                model.name = 'Bob';
                expect(model.name).toEqual('Kipper');

            });

            it('Should be able to assign a unique ID to the model;', function() {

                var collection  = catwalk.createCollection('cats', { name: '' }),
                    firstModel  = collection.addModel({ name: 'Kipper' }),
                    secondModel = collection.addModel({ name: 'Mango' }),
                    thirdModel  = collection.addModel({ name: 'Miss Kittens' });

                expect(firstModel.__catwalkId).toEqual(1);
                expect(secondModel.__catwalkId).toEqual(2);
                expect(thirdModel.__catwalkId).toEqual(3);

            });

            it('Should be able to delete and clear models;', function() {

                var collection  = catwalk.createCollection('cats', { name: '' }),
                    firstModel  = collection.addModel({ name: 'Splodge' }),
                    secondModel = collection.addModel({ name: 'Busters' }),
                    thirdModel  = collection.addModel({ name: 'Tinker' });

                expect(collection.models.length).toEqual(3);
                collection.deleteModel(firstModel);
                expect(collection.models.length).toEqual(2);
                collection.clearModels();
                expect(collection.models.length).toEqual(0);

            });

        });

    });

})(window.Catwalk);