/* eslint-disable indent */

// styles
import './styles/related-item.scss';
import './styles/assignment.scss';
import './styles/html-preview.scss';
import {includes, flatMap} from 'lodash';
import {reactToAngular1} from 'superdesk-ui-framework';

// scripts
import './related-item-widget/relatedItem';

import * as directive from './directives';
import * as svc from './services';
import * as ctrl from './controllers';

import {gettext} from 'core/utils';

import {extensions} from 'appConfig';

import {IExtensionActivationResult, IArticle} from 'superdesk-api';
import {showSpikeDialog} from './show-spike-dialog';
import {AuthoringWorkspaceService} from 'apps/authoring/authoring/services';
import * as actions from './actions';
import {RelatedView} from './views/related-view';
import {showUnsavedChangesPrompt, IUnsavedChangesAction} from 'core/ui/components/prompt-for-unsaved-changes';
import {assertNever} from 'core/helpers/typescript-helpers';
import {httpRequestJsonLocal, httpRequestRawLocal} from 'core/helpers/network';
import {sdApi} from 'api';
import {dispatchInternalEvent} from 'core/internal-events';

angular.module('superdesk.apps.archive.directives', [
    'superdesk.core.filters',
    'superdesk.apps.authoring',
    'superdesk.apps.ingest',
    'superdesk.core.workflow',
])
    .directive('sdItemLock', directive.ItemLock)
    .directive('sdItemState', directive.ItemState)
    .directive('sdInlineMeta', directive.InlineMeta)
    .directive('sdMediaPreview', directive.MediaPreview)
    .directive('sdMediaPreviewWidget', directive.MediaPreviewWidget)
    .directive('sdMediaMetadata', directive.MediaMetadata)
    .component('sdRelatedView', reactToAngular1(RelatedView, ['relatedItems'], []))
    .directive('sdFetchedDesks', directive.FetchedDesks)
    .directive('sdMetaIngest', directive.MetaIngest)
    .directive('sdDraggableItem', directive.DraggableItem)
    .directive('sdItemCrops', directive.ItemCrops)
    .directive('sdItemRendition', directive.ItemRendition)
    .directive('sdRatioCalc', directive.RatioCalc)
    .directive('sdHtmlPreview', directive.HtmlPreview)
    .directive('sdContentResults', directive.ContentResults)
    .directive('sdArchivedItemKill', directive.ArchivedItemKill)
    .directive('sdResendItem', directive.ResendItem)
    .directive('sdItemPriority', directive.ItemPriority)
    .directive('sdItemUrgency', directive.ItemUrgency)
    .directive('sdMarkedItemTitle', directive.MarkedItemTitle)
    .directive('sdExport', directive.Export)
    .directive('sdAssociatedItemMetadata', directive.AssociatedItemMetadata)
    .directive('sdMediaUsed', directive.MediaUsed)
    .directive('sdPackageItemLabelsDropdown', directive.PackageItemLabelsDropdown)
    .directive('sdAssignmentIcon', directive.AssignmentIcon)
    .directive('sdRelatedItemsPreview', directive.RelatedItemsPreview)
    .service('familyService', svc.FamilyService);

/**
 * @ngdoc module
 * @module superdesk.apps.archive
 * @name superdesk.apps.archive
 * @packageName superdesk.apps
 * @description Superdesk archive specific application.
 */
angular.module('superdesk.apps.archive', [
    'superdesk.apps.search',
    'superdesk.apps.archive.directives',
    'superdesk.apps.dashboard',
    'superdesk.apps.dashboard.widgets.base',
    'superdesk.apps.dashboard.widgets.relatedItem',
    'superdesk.apps.workspace.menu',
])
    .service('multi', svc.MultiService)
    .service('archiveService', svc.ArchiveService)

    .controller('UploadController', ctrl.UploadController)
    .controller('ArchiveListController', ctrl.ArchiveListController)

    .config(['superdeskProvider', 'workspaceMenuProvider', function(superdesk, workspaceMenuProvider) {
        superdesk
            .activity('/workspace/content', {
                label: gettext('Workspace'),
                priority: 100,
                controller: 'ArchiveListController',
                templateUrl: 'scripts/apps/archive/views/list.html',
                topTemplateUrl: 'scripts/apps/dashboard/views/workspace-topnav.html',
                sideTemplateUrl: 'scripts/apps/workspace/views/workspace-sidenav.html',
                filters: [
                    {action: 'view', type: 'content'},
                ],
                privileges: {archive: 1},
            })
            .activity('upload.media', {
                label: gettext('Upload media'),
                modal: true,
                cssClass: 'upload-media modal--fullscreen',
                controller: ctrl.UploadController,
                templateUrl: 'scripts/apps/archive/views/upload.html',
                filters: [
                    {action: 'upload', type: 'media'},
                ],
                additionalCondition: ['$location', function($location) {
                    return $location.path() !== '/planning';
                }],
                privileges: {archive: 1},
            })
            .activity('spike', {
                label: gettext('Spike Item'),
                icon: 'trash',
                monitor: true,
                controller: spikeActivity,
                filters: [{action: 'list', type: 'archive'}],
                action: 'spike',
                keyboardShortcut: 'ctrl+shift+#',
                additionalCondition: ['session', 'authoring', 'item', function(session, authoring, item) {
                    return authoring.itemActions(item).spike &&
                        (item.lock_user === null || angular.isUndefined(item.lock_user) ||
                        item.lock_user === session.identity._id);
                }],
            })
            .activity('unspike', {
                label: gettext('Unspike Item'),
                icon: 'unspike',
                monitor: true,
                controller: ['data', function(data) {
                    dispatchInternalEvent('interactiveArticleActionStart', {
                        items: [data.item],
                        tabs: ['unspike'],
                        activeTab: 'unspike',
                    });
                }],
                filters: [{action: 'list', type: 'spike'}],
                action: 'unspike',
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).unspike;
                }],
            })
            .activity('duplicateInPlace', {
                label: gettext('Duplicate in place'),
                icon: 'copy',
                monitor: true,
                controller: ctrl.DuplicateController,
                filters: [
                    {action: 'list', type: 'archive'},
                ],
                keyboardShortcut: 'ctrl+alt+d',
                privileges: {duplicate: 1},
                condition: function(item) {
                    return item.lock_user === null || angular.isUndefined(item.lock_user);
                },
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).duplicate &&
                        (item.state !== 'killed' || item.state !== 'recalled');
                }],
                group: 'duplicate',
                groupLabel: gettext('Duplicate'),
                groupIcon: 'copy',
            })
            .activity('duplicateTo', {
                label: gettext('Duplicate To'),
                icon: 'copy',
                monitor: true,
                controller: ['data', function(data) {
                    dispatchInternalEvent('interactiveArticleActionStart', {
                        items: [data.item],
                        tabs: ['duplicate_to'],
                        activeTab: 'duplicate_to',
                    });
                }],
                filters: [
                    {action: 'list', type: 'archive'},
                    {action: 'list', type: 'archived'},
                ],
                keyboardShortcut: 'ctrl+alt+r',
                privileges: {duplicate: 1},
                condition: function(item) {
                    return item.lock_user === null || angular.isUndefined(item.lock_user);
                },
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return (item.state !== 'killed' || item.state !== 'recalled') &&
                        !authoring.isContentApiItem(item) && authoring.itemActions(item).duplicateTo;
                }],
                group: 'duplicate',
                groupLabel: gettext('Duplicate'),
                groupIcon: 'copy',
            })
            .activity('duplicateToPersonal', {
                label: gettext('Duplicate to personal'),
                icon: 'copy',
                monitor: true,
                controller: ['data', '$injector', (data, $injector) => {
                    data.isPersonal = true;
                    $injector.invoke(ctrl.DuplicateController, {}, {data});
                }],
                filters: [{action: 'list', type: 'archive'}],
                condition: (item: IArticle) => item.lock_user == null && item.task?.desk != null,
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).copy
                    && item.state !== 'correction' && item.state !== 'being_corrected';
                }],
                group: 'duplicate',
                groupLabel: gettext('Duplicate'),
                groupIcon: 'copy',
                priority: -10,
            })
            .activity('label', {
                label: gettext('Set label in current package'),
                priority: 30,
                icon: 'label',
                monitor: true,
                list: false,
                keyboardShortcut: 'ctrl+alt+l',
                filters: [{action: 'list', type: 'archive'}],
                group: 'labels',
                dropdown: true,
                templateUrl: 'scripts/apps/archive/views/package_item_labels_dropdown.html',
                additionalCondition: ['authoring', 'item', 'vocabularies', 'authoringWorkspace', 'packages',
                    function(
                        authoring,
                        item,
                        vocabularies,
                        authoringWorkspace: AuthoringWorkspaceService,
                        packages,
                    ) {
                        var openedItem = authoringWorkspace.getItem();

                        return (item.state !== 'killed' || item.state !== 'recalled') &&
                            !authoring.isContentApiItem(item) && authoring.itemActions(item).set_label &&
                            openedItem && openedItem.type === 'composite' &&
                            packages.isAdded(openedItem, item) && vocabularies.isInit();
                    }],
            })
            .activity('createBroadcast', {
                label: gettext('Create Broadcast'),
                icon: 'broadcast',
                monitor: true,
                controller: ['api', '$rootScope', 'data', 'desks', 'authoringWorkspace',
                    function(api, $rootScope, data, desks, authoringWorkspace: AuthoringWorkspaceService) {
                        api.save('archive_broadcast', {}, {desk: desks.getCurrentDeskId()}, data.item)
                            .then((broadcastItem) => {
                                authoringWorkspace.edit(broadcastItem);
                                $rootScope.$broadcast('broadcast:created', {item: data.item});
                            });
                    }],
                filters: [{action: 'list', type: 'archive'}],
                keyboardShortcut: 'ctrl+b',
                privileges: {archive_broadcast: 1},
                condition: function(item) {
                    return item.lock_user === null || angular.isUndefined(item.lock_user);
                },
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).create_broadcast;
                }],
            })
            .activity('copy', {
                label: gettext('Copy'),
                icon: 'copy',
                monitor: true,
                controller: ['api', 'data', '$rootScope', (api, data, $rootScope) =>
                    actions.copy(data.item, api, $rootScope)],
                filters: [{action: 'list', type: 'archive'}],
                condition: (item: IArticle) => item.lock_user == null && item.task?.desk == null,
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).copy;
                }],
            })
            .activity('resend', {
                label: gettext('Resend item'),
                priority: 100,
                icon: 'share-alt',
                group: 'corrections',
                controller: ['data', '$rootScope', function(data, $rootScope) {
                    $rootScope.$broadcast('open:resend', data.item);
                }],
                filters: [{action: 'list', type: 'archive'}],
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).resend;
                }],
                privileges: {resend: 1},
            })
            .activity('rewrite', {
                label: gettext('Update'),
                icon: 'edit-line',
                filters: [{action: 'list', type: 'archive'}],
                group: 'corrections',
                privileges: {rewrite: 1},
                condition: function(item) {
                    return item.lock_user === null || angular.isUndefined(item.lock_user);
                },
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).re_write;
                }],
                controller: ['data', 'authoring', function(data, authoring) {
                    authoring.rewrite(data.item);
                }],
            })
            .activity('unlinkRewrite', {
                label: gettext('Unlink update'),
                icon: 'remove-sign',
                filters: [{action: 'list', type: 'archive'}],
                group: 'corrections',
                privileges: {rewrite: 1},
                condition: function(item) {
                    return item.lock_user === null || angular.isUndefined(item.lock_user);
                },
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).unlinkUpdate;
                }],
                controller: ['data', 'authoring', function(data, authoring) {
                    authoring.unlink(data.item);
                }],
            })
            .activity('cancelCorrection', {
                label: gettext('Cancel correction'),
                icon: 'remove-sign',
                filters: [{action: 'list', type: 'archive'}],
                group: 'corrections',
                privileges: {correct: 1},
                condition: function(item) {
                    return item.lock_user === null || angular.isUndefined(item.lock_user);
                },
                additionalCondition: ['authoring', 'item', function(authoring, item) {
                    return authoring.itemActions(item).cancelCorrection;
                }],
                controller: ['data', 'authoring', function(data, authoring) {
                    authoring.correction(data.item.archive_item || data.item, false, true);
                }],
            })
            .activity('export', {
                label: gettext('Export'),
                icon: 'download',
                templateUrl: 'scripts/apps/archive/views/export-dropdown.html',
                filters: [{action: 'list', type: 'archive'}],
                privileges: {content_export: 1},
                additionalCondition: ['session', 'authoring', 'item',
                    function(session, authoring, item) {
                        let lockCond = item.lock_user === null || angular.isUndefined(item.lock_user) ||
                            item.lock_user === session.identity._id;

                        return lockCond && authoring.itemActions(item).export;
                    }],
                modal: true,
                zIndex: '1050',
                cssClass: 'modal-responsive',
                controller: ['$scope', function($scope) {
                    $scope.export = true;
                    $scope.item = $scope.locals.data.item;

                    $scope.closeExport = function() {
                        $scope.export = false;
                        $scope.reject();
                    };
                }],
            });

        workspaceMenuProvider.item({
            href: '/workspace/content',
            label: gettext('Content'),
            icon: 'archive',
            if: 'workspaceConfig.content && privileges.archive',
            order: 700,
        });
    }])

    .config(['apiProvider', function(apiProvider) {
        apiProvider.api('copy', {
            type: 'http',
            backend: {
                rel: 'copy',
            },
        });
        apiProvider.api('duplicate', {
            type: 'http',
            backend: {
                rel: 'duplicate',
            },
        });
        apiProvider.api('notification', {
            type: 'http',
            backend: {
                rel: 'notification',
            },
        });
        apiProvider.api('archive', {
            type: 'http',
            backend: {
                rel: 'archive',
            },
        });
        apiProvider.api('archive_rewrite', {
            type: 'http',
            backend: {
                rel: 'archive_rewrite',
            },
        });
    }]);

spikeActivity.$inject = [
    'data',
    'modal',
    '$location',
    'multi',
    'authoringWorkspace',
    'confirm',
    'autosave',
    '$rootScope',
];

function spikeActivity(data, modal, $location, multi,
    authoringWorkspace: AuthoringWorkspaceService, confirm, autosave, $rootScope) {
    // For the sake of keyboard shortcut to work consistently,
    // if the item is multi-selected, let multibar controller handle its spike
    if (!data.item || multi.count > 0 && includes(multi.getIds(), data.item._id)) {
        return;
    }

    const checkIfHasUnsavedChanges = data.item.lock_user == null
        ? Promise.resolve(false)
        : autosave.hasUnsavedChanges(data.item);

    checkIfHasUnsavedChanges.then((hasUnsavedChanges) => {
        if (hasUnsavedChanges) {
            showUnsavedChangesPrompt().then(({action, closePromptFn}) => {
                autosave.settle(data.item).then(() => {
                    switch (action) {
                    case IUnsavedChangesAction.cancelAction:
                        closePromptFn();
                        break;

                    case IUnsavedChangesAction.discardChanges:
                        httpRequestJsonLocal<IArticle>({
                            method: 'GET',
                            path: `/archive_autosave/${data.item._id}`,
                        }).then((item) => httpRequestRawLocal({
                            method: 'DELETE',
                            path: `/archive_autosave/${item._id}`,
                            headers: {
                                'If-Match': item._etag,
                            },
                        }).then(() => {
                            $rootScope.$applyAsync();
                            closePromptFn();
                            _spike();
                        }));

                        break;

                    case IUnsavedChangesAction.openItem:
                        closePromptFn();
                        authoringWorkspace.edit(data.item);
                        break;

                    default:
                        assertNever(action);
                    }
                });
            });
        } else {
            _spike();
        }
    });

    function _spike() {
        if (sdApi.navigation.isPersonalSpace()) {
            return modal.confirm(gettext('Do you want to delete the item permanently?'), gettext('Confirm'))
                .then(() => sdApi.article.doSpike(data.item));
        }

        const onSpikeMiddlewares
            : Array<IExtensionActivationResult['contributions']['entities']['article']['onSpike']>
            = flatMap(
                Object.values(extensions).map(({activationResult}) => activationResult),
                (activationResult) =>
                    activationResult.contributions != null
                    && activationResult.contributions.entities != null
                    && activationResult.contributions.entities.article != null
                    && activationResult.contributions.entities.article.onSpike != null
                        ? activationResult.contributions.entities.article.onSpike
                        : [],
            );

        const item: IArticle = data.item;

        showSpikeDialog(
            modal,
            () => sdApi.article.doSpike(data.item),
            gettext('Are you sure you want to spike the item?'),
            onSpikeMiddlewares,
            item,
        );
    }
}
