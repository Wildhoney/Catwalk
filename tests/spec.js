(function($catwalk) {

    describe('Catwalk', function() {

        describe('Collections', function() {

            it('Can create collections', function() {

                $catwalk.deleteCollection('catsOne');
                $catwalk.collection('catsOne', {
                    name: $catwalk.attribute.string
                });

                expect(typeof $catwalk.collection('catsOne')).toEqual('object');
                expect($catwalk.collection('catsOne')._name).toEqual('catsOne');

            });

        });

//        describe('Models', function() {
//
//            var $cats;
//
//            beforeEach(function() {
//
//                $catwalk.deleteCollection('catsTwo');
//                $cats = $catwalk.collection('catsTwo', {
//                    _primaryKey: 'id',
//                    friends: $catwalk.relationship.hasMany({
//                        collection: 'catsTwo',
//                        foreignKey: 'id'
//                    }),
//                    id: $catwalk.attribute.integer,
//                    name: $catwalk.attribute.string
//                });
//
//            });
//
//            it('Can create models', function() {
//                $cats.createModel({ id: 1, name: 'Kipper' });
//                $cats.createModel({ id: 2, name: 'Miss Kittens' });
//                $cats.createModel({ id: 3, name: 'Busters' });
//                expect($cats.all().length).toEqual(3);
//            });
//
//            it('Can update models', function() {
//                var kipper = $cats.createModel({ id: 1, name: 'Kipper' });
//                expect($cats.all()[0].name).toEqual('Kipper');
//                $cats.updateModel(kipper, { name: 'Darling Kipper' });
//                expect($cats.all()[0].name).toEqual('Darling Kipper');
//            });
//
//            it('Can delete models', function() {
//                $cats.createModel({ id: 1, name: 'Kipper' });
//                var missKittens = $cats.createModel({ id: 2, name: 'Miss Kittens' });
//                $cats.createModel({ id: 3, name: 'Busters' });
//                $cats.deleteModel(missKittens);
//                expect($cats.all().length).toEqual(2);
//            });
//
//        });
//
//        describe('Relationships', function() {
//
//            var $cats;
//
//            beforeEach(function() {
//
//                $catwalk.deleteCollection('catsThree');
//                $cats = $catwalk.collection('catsThree', {
//                    _primaryKey: 'id',
//                    friends: $catwalk.relationship.hasMany({
//                        collection: 'catsThree',
//                        foreignKey: 'id'
//                    }),
//                    sibling: $catwalk.relationship.hasOne({
//                        collection: 'catsThree',
//                        foreignKey: 'id'
//                    }),
//                    id: $catwalk.attribute.integer,
//                    name: $catwalk.attribute.string
//                });
//
//            });
//
//            it('Can use hasOne relationship', function() {
//                $cats.createModel({ id: 1, name: 'Kipper' });
//                $cats.createModel({ id: 2, name: 'Miss Kittens' });
//                var busters = $cats.createModel({ id: 3, name: 'Busters', sibling: 2 });
//                expect(busters.sibling.name).toEqual('Miss Kittens');
//            });
//
//            it('Can use hasMany relationship', function() {
//                $cats.createModel({ id: 1, name: 'Kipper' });
//                $cats.createModel({ id: 2, name: 'Miss Kittens' });
//                var busters = $cats.createModel({ id: 3, name: 'Busters', friends: [1, 2] });
//                expect(busters.friends.length).toEqual(2);
//                expect(busters.friends[0].name).toEqual('Miss Kittens');
//                expect(busters.friends[1].name).toEqual('Kipper');
//            });
//
//        });

    });

})(window.catwalk);