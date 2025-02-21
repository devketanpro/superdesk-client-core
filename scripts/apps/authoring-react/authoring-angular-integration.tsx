/* eslint-disable react/display-name */
/* eslint-disable react/no-multi-comp */
import {assertNever} from 'core/helpers/typescript-helpers';
import {DeskAndStage} from './subcomponents/desk-and-stage';
import {LockInfo} from './subcomponents/lock-info';
import {
    Button,
    ButtonGroup,
    IconButton,
    Label,
    Modal,
    NavButton,
    Popover,
    Spacer,
    WithPopover,
} from 'superdesk-ui-framework/react';
import {
    IArticle,
    ITopBarWidget,
    IExposedFromAuthoring,
    IAuthoringOptions,
    IAuthoringActionType,
} from 'superdesk-api';
import {appConfig, extensions} from 'appConfig';
import {ITEM_STATE} from 'apps/archive/constants';
import React from 'react';
import {gettext, getArticleLabel} from 'core/utils';
import {sdApi} from 'api';
import ng from 'core/services/ng';
import {AuthoringIntegrationWrapper} from './authoring-integration-wrapper';
import {MarkedDesks} from './toolbar/mark-for-desks/mark-for-desks-popover';
import {HighlightsCardContent} from './toolbar/highlights-management';
import {
    authoringStorageIArticle,
    authoringStorageIArticleCorrect,
    getAuthoringStorageIArticleKillOrTakedown,
} from './data-layer';
import {
    IStateInteractiveActionsPanelHOC,
    IActionsInteractiveActionsPanelHOC,
} from 'core/interactive-article-actions-panel/index-hoc';
import {IArticleActionInteractive} from 'core/interactive-article-actions-panel/interfaces';
import {dispatchInternalEvent} from 'core/internal-events';
import {notify} from 'core/notify/notify';
import {showModal} from '@superdesk/common';
import {ToggleFullWidth} from 'apps/authoring/authoring/components/toggleFullWithEditor';

function onClose() {
    ng.get('authoringWorkspace').close();
    ng.get('$rootScope').$applyAsync();
}

function getInlineToolbarActions(
    options: IExposedFromAuthoring<IArticle>,
    action?: IAuthoringActionType,
    setFullWidth?: () => void,
    fullWidth?: boolean,
): IAuthoringOptions<IArticle> {
    const {
        item,
        hasUnsavedChanges,
        handleUnsavedChanges,
        save,
        initiateClosing,
        keepChangesAndClose,
        stealLock,
        getLatestItem,
    } = options;
    const itemState: ITEM_STATE = item.state;

    const saveButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.2,
        component: () => (
            <Button
                text={gettext('Save')}
                style="filled"
                type="primary"
                disabled={!hasUnsavedChanges()}
                onClick={() => {
                    save();
                }}
            />
        ),
        availableOffline: true,
        keyBindings: {
            'ctrl+shift+s': () => {
                if (hasUnsavedChanges()) {
                    save();
                }
            },
        },
    };

    const closeButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text={gettext('Close')}
                style="hollow"
                onClick={() => {
                    initiateClosing();
                }}
            />
        ),
        availableOffline: true,
        keyBindings: {
            'ctrl+shift+e': () => {
                initiateClosing();
            },
        },
    };

    const closeIconButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <IconButton
                ariaValue="Close"
                icon="close-small"
                onClick={() => {
                    initiateClosing();
                }}
                style="outline"
            />
        ),
        availableOffline: true,
        keyBindings: {
            'ctrl+shift+e': () => {
                initiateClosing();
            },
        },
    };

    const minimizeButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.3,
        component: () => (
            <NavButton
                text={gettext('Minimize')}
                onClick={() => {
                    keepChangesAndClose();
                }}
                icon="minimize"
                iconSize="big"
            />
        ),
        availableOffline: true,
    };

    const toggleFullWidthButton: ITopBarWidget<IArticle> = {
        group: 'start',
        priority: 0.1,
        component: () => (
            <ToggleFullWidth
                setFullWidth={() => {
                    options.authoringStorage.autosave.flush().then(() => {
                        setFullWidth();
                    });
                }}
                fullWidth={fullWidth}
            />
        ),
        availableOffline: true,
    };

    const getManageHighlights = (): ITopBarWidget<IArticle> => ({
        group: 'start',
        priority: 0.3,
        component: () => (
            <WithPopover
                component={({closePopup}) => (
                    <HighlightsCardContent
                        close={closePopup}
                        article={item}
                    />
                )}
                placement="right-end"
            >
                {
                    (togglePopup) => (
                        <IconButton
                            onClick={(event) =>
                                togglePopup(event.target as HTMLElement)
                            }
                            icon={
                                item.highlights.length > 1
                                    ? 'multi-star'
                                    : 'star'
                            }
                            ariaValue={gettext('Highlights')}
                        />
                    )
                }
            </WithPopover>
        ),
        availableOffline: true,
    });

    const getReadOnlyAndArchivedFrom = (): Array<ITopBarWidget<IArticle>> => {
        const actions: Array<ITopBarWidget<IArticle>> = [];

        if (item._type === 'archived') {
            actions.push({
                group: 'start',
                availableOffline: false,
                component: () => (
                    <span>
                        <b>{gettext('Archived from')}</b>
                        <DeskAndStage article={item} />
                    </span>
                ),
                priority: 0.2,
            });
        }

        if (
            item._type !== 'archived'
            && sdApi.desks.getDeskStages(item.task.desk).get(item.task.stage).local_readonly
        ) {
            actions.push({
                group: 'start',
                availableOffline: false,
                component: () => (
                    <Label text={gettext('Read-only')} style="filled" type="warning" />
                ),
                priority: 0.3,
            });
        }

        return actions;
    };

    const correctAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                tooltip={gettext('Correct')}
                text={gettext('C')}
                style="filled"
                type="primary"
                onClick={() => {
                    if (appConfig?.corrections_workflow) {
                        ng.get('authoring').correction(item);
                    } else {
                        ng.get('authoringWorkspace').authoringOpen(item._id, 'correct');
                    }
                }}
            />
        ),
        availableOffline: false,
    };

    const sendCorrectionAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text={gettext('Send Correction')}
                style="filled"
                type="primary"
                onClick={() => {
                    sdApi.article.publishItem(item, getLatestItem(), 'correct').then(() => {
                        initiateClosing();
                    });
                }}
            />
        ),
        availableOffline: false,
    };

    const killAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text={gettext('K')}
                tooltip={gettext('Kill')}
                style="filled"
                type="primary"
                onClick={() => {
                    ng.get('authoringWorkspace').authoringOpen(item._id, 'kill');
                }}
            />
        ),
        availableOffline: false,
    };

    const takedownAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text="T"
                tooltip={gettext('Takedown')}
                style="filled"
                type="primary"
                onClick={() => {
                    ng.get('authoringWorkspace').authoringOpen(item._id, 'takedown');
                }}
            />
        ),
        availableOffline: false,
    };

    const unpublishAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                tooltip={gettext('Unpublish')}
                text={'UP'}
                style="filled"
                type="primary"
                onClick={() => {
                    showModal(({closeModal}) => (
                        <Modal
                            visible
                            size="small"
                            position="center"
                            onHide={closeModal}
                            headerTemplate={gettext('Confirm Unpublishing')}
                            footerTemplate={(
                                <Spacer h gap="4" justifyContent="end" noGrow>
                                    <Button
                                        onClick={() => {
                                            closeModal();
                                        }}
                                        text={gettext('Cancel')}
                                        style="filled"
                                        type="default"
                                    />
                                    <Button
                                        onClick={() => {
                                            closeModal();
                                            sdApi.article.publishItem(item, getLatestItem(), 'unpublish');
                                        }}
                                        text={gettext('Confirm')}
                                        style="filled"
                                        type="primary"
                                    />
                                </Spacer>
                            )}
                        >
                            {gettext(
                                'Are you sure you want to unpublish item "{{label}}"?',
                                {label: getArticleLabel(item)},
                            )}
                        </Modal>
                    ));
                }}
            />
        ),
        availableOffline: false,
    };

    const cancelAuthoringAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text={gettext('CANCEL')}
                style="filled"
                type="default"
                onClick={() => {
                    initiateClosing();
                }}
            />
        ),
        availableOffline: false,
    };

    const updateAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text="U"
                tooltip={gettext('UPDATE')}
                style="filled"
                type="primary"
                onClick={() => {
                    sdApi.article.rewrite(item);
                }}
            />
        ),
        availableOffline: false,
    };

    const sendKillAction: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: ({entity}) => {
            return (
                <Button
                    text={gettext('Send kill')}
                    style="filled"
                    type="primary"
                    onClick={() => {
                        handleUnsavedChanges()
                            .then(() => {
                                sdApi.article.publishItem(item, entity, 'kill');
                            })
                            .then(() => initiateClosing());
                    }}
                />
            );
        },
        availableOffline: false,
    };

    if (action === 'kill') {
        return {
            readOnly: false,
            actions: [toggleFullWidthButton, sendKillAction, closeIconButton, minimizeButton],
        };
    }

    if (action === 'correct') {
        return {
            readOnly: false,
            actions: [toggleFullWidthButton, sendCorrectionAction, cancelAuthoringAction, minimizeButton],
        };
    }

    switch (itemState) {
    case ITEM_STATE.DRAFT:
        return {
            readOnly: false,
            actions: [toggleFullWidthButton, closeButton, saveButton, minimizeButton, ...getReadOnlyAndArchivedFrom()],
        };

    case ITEM_STATE.SUBMITTED:
    case ITEM_STATE.IN_PROGRESS:
    case ITEM_STATE.ROUTED:
    case ITEM_STATE.FETCHED:
    case ITEM_STATE.UNPUBLISHED:
        // eslint-disable-next-line no-case-declarations
        const actions: Array<ITopBarWidget<IArticle>> = [
            toggleFullWidthButton,
            minimizeButton,
            closeButton,
            ...getReadOnlyAndArchivedFrom(),
        ];

        if (item.highlights != null) {
            actions.push(getManageHighlights());
        }

        // eslint-disable-next-line no-case-declarations
        const manageDesksButton: ITopBarWidget<IArticle> = ({
            group: 'start',
            priority: 0.3,
            // eslint-disable-next-line react/display-name
            component: () => (
                <>
                    <Popover
                        triggerSelector="#marked-for-desks"
                        title={gettext('Marked for')}
                        placement="bottom-end"
                    >
                        <MarkedDesks
                            article={item}
                        />
                    </Popover>
                    <NavButton
                        onClick={() => null}
                        id="marked-for-desks"
                        icon="bell"
                        iconSize="small"
                    />
                </>
            ),
            availableOffline: true,
        });

        if (item.marked_desks?.length > 0) {
            actions.push(manageDesksButton);
        }

        if (item._type !== 'archived') {
            actions.push({
                group: 'start',
                priority: 0.2,
                component: ({entity}) => <DeskAndStage article={entity} />,
                availableOffline: false,
            });
        }

        if (sdApi.highlights.showHighlightExportButton(item)) {
            actions.push({
                group: 'end',
                priority: 0.4,
                component: () => (
                    <Button
                        type="default"
                        onClick={() => {
                            sdApi.highlights.exportHighlight(item._id, hasUnsavedChanges());
                        }}
                        text={gettext('Export')}
                        style="filled"
                    />
                ),
                availableOffline: false,
            });
        }

        if (sdApi.article.showPublishAndContinue(item, hasUnsavedChanges())) {
            actions.push({
                group: 'middle',
                priority: 0.3,
                component: ({entity}) => (
                    <Button
                        type="highlight"
                        onClick={() => {
                            const getLatestArticle = hasUnsavedChanges()
                                ? handleUnsavedChanges()
                                : Promise.resolve(entity);

                            getLatestArticle.then((article) => {
                                sdApi.article.publishItem(article, article).then((result) => {
                                    typeof result !== 'boolean'
                                        ? ng.get('authoring').rewrite(result)
                                        : notify.error(gettext('Failed to publish and continue.'));
                                });
                            });
                        }}
                        text={gettext('P & C')}
                        style="filled"
                    />
                ),
                availableOffline: false,
            });
        }

        if (action === 'view' && item._editable !== true) {
            actions.push({
                group: 'middle',
                priority: 0.4,
                component: ({entity}) => (
                    <Button
                        type="primary"
                        onClick={() => {
                            sdApi.article.edit({_id: entity._id, _type: entity._type, state: entity.state});
                        }}
                        text={gettext('Edit')}
                        style="filled"
                    />
                ),
                availableOffline: false,
            });
        }

        if (sdApi.article.showCloseAndContinue(item, hasUnsavedChanges())) {
            actions.push({
                group: 'middle',
                priority: 0.4,
                component: ({entity}) => (
                    <Button
                        type="highlight"
                        onClick={() => {
                            const getLatestArticle = hasUnsavedChanges()
                                ? handleUnsavedChanges()
                                : Promise.resolve(entity);

                            getLatestArticle.then((article) => {
                                ng.get('authoring').close().then(() => {
                                    sdApi.article.rewrite(article);
                                });
                            });
                        }}
                        text={gettext('C & C')}
                        style="filled"
                    />
                ),
                availableOffline: false,
            });
        }

        // FINISH: ensure locking is available in generic version of authoring
        actions.push({
            group: 'start',
            priority: 0.1,
            component: ({entity}) => (
                <LockInfo
                    article={entity}
                    unlock={() => {
                        stealLock();
                    }}
                    isLockedInOtherSession={(article) => sdApi.article.isLockedInOtherSession(article)}
                />
            ),
            keyBindings: {
                'ctrl+shift+u': () => {
                    if (sdApi.article.isLockedInOtherSession(item)) {
                        stealLock();
                    }
                },
            },
            availableOffline: false,
        });

        if (sdApi.article.isLockedInCurrentSession(item)) {
            actions.push(saveButton);
        }

        if (
            sdApi.article.isLockedInCurrentSession(item)
            && appConfig.features.customAuthoringTopbar.toDesk === true
            && sdApi.article.isPersonal(item) !== true
        ) {
            actions.push({
                group: 'middle',
                priority: 0.2,
                component: () => (
                    <Button
                        tooltip={gettext('To Desk')}
                        text={gettext('T D')}
                        style="filled"
                        onClick={() => {
                            handleUnsavedChanges()
                                .then(() => sdApi.article.sendItemToNextStage(item))
                                .then(() => initiateClosing());
                        }}
                    />
                ),
                availableOffline: false,
            });
        }

        return {
            readOnly: sdApi.article.isLockedInCurrentSession(item) !== true,
            actions: actions,
        };

    case ITEM_STATE.INGESTED:
        return {
            readOnly: true,
            actions: [], // fetch
        };

    case ITEM_STATE.SPIKED:
        return {
            readOnly: false,
            actions: [
                {
                    group: 'end',
                    priority: 0.1,
                    component: () => (
                        <Button
                            text={gettext('UNSPIKE')}
                            style="filled"
                            type="primary"
                            onClick={() => {
                                sdApi.article.doUnspike(item, item.task.desk, item.task.stage);
                            }}
                        />
                    ),
                    availableOffline: false,
                },
                toggleFullWidthButton,
                closeIconButton,
            ],
        };

    case ITEM_STATE.SCHEDULED:
        return {
            readOnly: false,
            actions: [
                {
                    group: 'end',
                    priority: 0.1,
                    component: () => (
                        <Button
                            text={gettext('Deschedule')}
                            style="filled"
                            type="primary"
                            onClick={() => {
                                sdApi.article.deschedule(item);
                            }}
                        />
                    ),
                    availableOffline: false,
                },
                toggleFullWidthButton,
                closeIconButton,
            ],
        };

    case ITEM_STATE.PUBLISHED:
    case ITEM_STATE.CORRECTED:
        return {
            readOnly: true,
            actions: [
                toggleFullWidthButton,
                updateAction,
                correctAction,
                takedownAction,
                unpublishAction,
                killAction,
                closeIconButton,
            ],
        };

    case ITEM_STATE.BEING_CORRECTED:
        return {
            readOnly: false,
            actions: [toggleFullWidthButton, closeIconButton, saveButton],
        };

    case ITEM_STATE.CORRECTION:
        return {
            readOnly: false,
            actions: [
                toggleFullWidthButton,
                saveButton,
                {
                    group: 'end',
                    priority: 0.1,
                    component: () => (
                        <Button
                            text={gettext('PUBLISH')}
                            style="filled"
                            type="primary"
                            onClick={() => {
                                handleUnsavedChanges()
                                    .then(() => sdApi.article.publishItem(item, getLatestItem(), 'publish'))
                                    .then(() => initiateClosing());
                            }}
                        />
                    ),
                    availableOffline: false,
                },
                cancelAuthoringAction,
            ],
        };

    case ITEM_STATE.KILLED:
        return {
            readOnly: true,
            actions: [toggleFullWidthButton, closeIconButton],
        };

    case ITEM_STATE.RECALLED:
        return {
            readOnly: true,
            actions: [toggleFullWidthButton, closeIconButton],
        };
    default:
        assertNever(itemState);
    }
}

function getPublishToolbarWidget(
    panelState: IStateInteractiveActionsPanelHOC,
    panelActions: IActionsInteractiveActionsPanelHOC,
): ITopBarWidget<IArticle> {
    const publishWidgetButton: ITopBarWidget<IArticle> = {
        priority: 99,
        availableOffline: false,
        group: 'end',
        // eslint-disable-next-line react/display-name
        component: (props: {entity: IArticle}) => (
            <ButtonGroup align="end">
                <ButtonGroup subgroup={true} spaces="no-space">
                    <NavButton
                        type="highlight"
                        icon="send-to"
                        iconSize="big"
                        text={gettext('Send to / Publish')}
                        onClick={() => {
                            if (panelState.active) {
                                panelActions.closePanel();
                            } else {
                                const availableTabs: Array<IArticleActionInteractive> = [
                                    'send_to',
                                ];

                                const canPublish =
                                    sdApi.article.canPublish(props.entity);

                                if (canPublish) {
                                    availableTabs.push('publish');
                                }

                                dispatchInternalEvent('interactiveArticleActionStart', {
                                    items: [props.entity],
                                    tabs: availableTabs,
                                    activeTab: canPublish ? 'publish' : availableTabs[0],
                                });
                            }
                        }}
                    />
                </ButtonGroup>
            </ButtonGroup>
        ),
    };

    return publishWidgetButton;
}

export function getAuthoringPrimaryToolbarWidgets(
    panelState: IStateInteractiveActionsPanelHOC,
    panelActions: IActionsInteractiveActionsPanelHOC,
) {
    return Object.values(extensions)
        .flatMap(({activationResult}) =>
                activationResult?.contributions?.authoringTopbarWidgets ?? [],
        )
        .map((item): ITopBarWidget<IArticle> => {
            const Component = item.component;

            return {
                ...item,
                component: (props: {entity: IArticle}) => (
                    <Component entity={props.entity} />
                ),
            };
        })
        .concat([getPublishToolbarWidget(panelState, panelActions)]);
}

export interface IProps {
    action?: IAuthoringActionType;
    itemId: IArticle['_id'];
    setFullWidth: () => void;
    fullWidth: boolean;
}

export class AuthoringAngularIntegration extends React.PureComponent<IProps> {
    render(): React.ReactNode {
        return (
            <div className="sd-authoring-react">
                <AuthoringIntegrationWrapper
                    sidebarMode={true}
                    getAuthoringPrimaryToolbarWidgets={getAuthoringPrimaryToolbarWidgets}
                    itemId={this.props.itemId}
                    onClose={onClose}
                    getInlineToolbarActions={(exposed) => getInlineToolbarActions(
                        exposed,
                        this.props.action,
                        this.props.setFullWidth,
                        this.props.fullWidth,
                    )}
                    authoringStorage={(() => {
                        if (this.props.action === 'kill' || this.props.action === 'takedown') {
                            return getAuthoringStorageIArticleKillOrTakedown(this.props.action);
                        } else if (this.props.action === 'correct') {
                            return authoringStorageIArticleCorrect;
                        } else {
                            return authoringStorageIArticle;
                        }
                    })()}
                />
            </div>
        );
    }
}
