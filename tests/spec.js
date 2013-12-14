(function($catwalk) {

    describe('Catwalk', function() {

        describe('Collections', function() {

            it('Can create collections', function() {

                $catwalk.collection('cats', {
                    name: $catwalk.attribute.string
                });

                expect(typeof $catwalk.collection('cats')).toEqual('object');
                expect($catwalk.collection('cats')._name).toEqual('cats');

            });

        });

        describe('Models', function() {

            var $cats;

            beforeEach(function() {

                $cats = $catwalk.collection('cats', {
                    _primaryKey: 'id',
                    friends: $catwalk.relationship.hasMany({
                        collection: 'cats',
                        foreignKey: 'id'
                    }),
                    id: $catwalk.attribute.integer,
                    name: $catwalk.attribute.string
                });

            });

            it('Can create models', function() {
                $cats.createModel({ id: 1, name: 'Kipper' });
                $cats.createModel({ id: 2, name: 'Miss Kittens' });
                $cats.createModel({ id: 3, name: 'Busters' });
                expect($cats.all().length).toEqual(3);
            });

//            it('Can read models', function() {
//                $cats.watch('read', function(deferred, id) {
//                    if (id === 4) {
//                        deferred.resolve({ id: 4, name: 'Tom' });
//                        console.log($cats.all());
//                    }
//                });
//                $cats.createModel({ id: 1, name: 'Miss Kittens' });
//                $cats.createModel({ id: 2, name: 'Busters' });
//                $cats.createModel({ id: 3, name: 'Kipper', friends: [1, 2, 4] });
//
//            });

            it('Can update models', function() {
                var kipper = $cats.createModel({ id: 1, name: 'Kipper' });
                expect($cats.all()[0].name).toEqual('Kipper');
                $cats.updateModel(kipper, { name: 'Darling Kipper' });
                expect($cats.all()[0].name).toEqual('Darling Kipper');
            });

            it('Can delete models', function() {
                $cats.createModel({ id: 1, name: 'Kipper' });
                var missKittens = $cats.createModel({ id: 2, name: 'Miss Kittens' });
                $cats.createModel({ id: 3, name: 'Busters' });
                $cats.deleteModel(missKittens);
                expect($cats.all().length).toEqual(2);
            });

        });

    });

})(window.catwalk);