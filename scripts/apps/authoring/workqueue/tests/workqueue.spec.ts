describe('workqueue', () => {
    var USER_ID = 'u1';

    angular.module('mock.route', ['ngRoute'])
        .config(($routeProvider) => {
            $routeProvider.when('/mock', {
                template: '',
            });
        });

    beforeEach(window.module('mock.route'));
    beforeEach(window.module('superdesk.apps.authoring.workqueue'));
    beforeEach(window.module('superdesk.templates-cache'));
    beforeEach(window.module('superdesk.apps.authoring'));
    beforeEach(window.module('superdesk.apps.searchProviders'));
    beforeEach(window.module('superdesk.apps.spellcheck'));

    beforeEach(inject((session, $q) => {
        spyOn(session, 'getIdentity').and.returnValue($q.when({_id: USER_ID}));
    }));

    it('loads locked items of current user', (done) => inject((workqueue, api, session, $q, $rootScope) => {
        const query = {
            source: {
                query: {
                    bool: {
                        must: [
                            {term: {lock_user: USER_ID}},
                            {terms: {lock_action: ['edit', 'correct', 'kill']}},
                        ],
                    },
                },
            },
            auto: 1,
        };

        spyOn(api, 'query').and.returnValue($q.when({_items: [{}]}));

        workqueue.fetch().then(() => {
            const items = workqueue.items;

            expect(items.length).toBe(1);
            expect(items).toBe(workqueue.items);
            expect(api.query).toHaveBeenCalledWith('workqueue', query);
            expect(session.getIdentity).toHaveBeenCalled();

            done();
        });

        $rootScope.$apply();
    }));

    it('can update single item', inject((workqueue, api, $q, $rootScope) => {
        spyOn(api, 'find').and.returnValue($q.when({_etag: 'xy'}));

        workqueue.items = [{_id: '1'}];
        workqueue.updateItem('1');

        $rootScope.$digest();

        expect(api.find).toHaveBeenCalledWith('archive', '1');
        expect(workqueue.items[0]._etag).toBe('xy');
    }));

    it('can get active item from url', inject(
        (api, $location, $controller, $q, $rootScope) => {
            spyOn(api, 'query').and.returnValue($q.when({_items: [{_id: 'foo'}]}));
            $location.path('/mock');
            $location.search('item', 'foo');
            $rootScope.$digest();

            var scope = $rootScope.$new();

            $controller('Workqueue', {$scope: scope});
            $rootScope.$digest();
            expect(scope.articleInEditMode._id).toBe('foo');
        }));
});
