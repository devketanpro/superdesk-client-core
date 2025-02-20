import * as React from 'react';
import {OrderedMap, OrderedSet, Map} from 'immutable';
import {Switch, Button, ButtonGroup, EmptyState, Autocomplete, Modal} from 'superdesk-ui-framework/react';
import {ToggleBoxNext} from 'superdesk-ui-framework';
import {showModal} from '@superdesk/common';

import {IArticle, IArticleSideWidget, ISuperdesk} from 'superdesk-api';

import {getTagsListComponent} from './tag-list';
import {getNewItemComponent} from './new-item';
import {ITagUi} from './types';
import {toClientFormat, IServerResponse, toServerFormat} from './adapter';
import {SOURCE_IMATRICS} from './constants';
import {getGroups} from './groups';
import {getAutoTaggingVocabularyLabels} from './common';
import {getExistingTags, createTagsPatch} from './data-transformations';
import {noop} from 'lodash';

import {ImageTagging} from './ImageTaggingComponent/ImageTaggingComponent';
import {AUTO_TAGGING_WIDGET_ID} from './extension';
import memoizeOne from 'memoize-one';

export const entityGroups = OrderedSet(['place', 'person', 'organisation']);

export type INewItem = Partial<ITagUi>;

interface IAutoTaggingResponse {
    analysis: OrderedMap<string, ITagUi>;
}

interface IAutoTaggingSearchResult {
    result: {
        tags: IServerResponse;

        /**
         * When search is performed, this will contain
         * all parents of items that matched the search query
         * and were returned in `tags` section.
         */
        broader?: IServerResponse;
    };
}

type IProps = React.ComponentProps<IArticleSideWidget['component']>;

interface IIMatricsFields {
    [key: string]: {
        name: string;
        order: number;
    };
}

type IEditableData = {original: IAutoTaggingResponse; changes: IAutoTaggingResponse};

interface IState {
    runAutomaticallyPreference: boolean | 'loading';
    data: 'not-initialized' | 'loading' | IEditableData;
    newItem: INewItem | null;
    vocabularyLabels: Map<string, string> | null;
    showImagesPreference: boolean;
}

const RUN_AUTOMATICALLY_PREFERENCE = 'run_automatically';
const SHOW_IMAGES_PREFERENCE = 'show_images';

function tagAlreadyExists(data: IEditableData, qcode: string): boolean {
    return data.changes.analysis.has(qcode);
}

export function hasConfig(key: string, iMatricsFields: IIMatricsFields) {
    return iMatricsFields[key] != null;
}

export function getAutoTaggingData(data: IEditableData, iMatricsConfig: any) {
    const items = data.changes.analysis;

    const isEntity = (tag: ITagUi) => entityGroups.has(tag.group.value);

    const entities = items.filter((tag) => isEntity(tag));
    const entitiesGrouped = entities.groupBy((tag) => tag?.group.value);

    const entitiesGroupedAndSortedByConfig = entitiesGrouped
        .filter((_, key) => hasConfig(key, iMatricsConfig.entities))
        .sortBy((_, key) => iMatricsConfig.entities[key].order,
            (a, b) => a - b);

    const entitiesGroupedAndSortedNotInConfig = entitiesGrouped
        .filter((_, key) => !hasConfig(key, iMatricsConfig.entities))
        .sortBy((_, key) => key!.toString().toLocaleLowerCase(),
            (a, b) => a.localeCompare(b));

    const entitiesGroupedAndSorted = entitiesGroupedAndSortedByConfig
        .concat(entitiesGroupedAndSortedNotInConfig);

    const others = items.filter((tag) => isEntity(tag) === false);
    const othersGrouped = others.groupBy((tag) => tag.group.value);

    return {entitiesGroupedAndSorted, othersGrouped};
}

function showImatricsServiceErrorModal(superdesk: ISuperdesk, errors: Array<ITagUi>) {
    const {gettext} = superdesk.localization;

    showModal(({closeModal}) => (
        <Modal
            visible
            size="small"
            position="top"
            onHide={closeModal}
            headerTemplate={
                gettext('iMatrics service error')
            }
            footerTemplate={
                (
                    <Button
                        text={gettext('close')}
                        onClick={() => {
                            closeModal();
                        }}
                    />
                )
            }
        >
            <h3>{gettext('Some tags can not be displayed')}</h3>

            <p>
                {
                    gettext(
                        'iMatrics service has returned tags referencing parents that do not exist in the response.',
                    )
                }
            </p>

            <table className="table">
                <thead>
                    <tr>
                        <th>{gettext('tag name')}</th>
                        <th>{gettext('qcode')}</th>
                        <th>{gettext('parent ID')}</th>
                    </tr>
                </thead>

                <tbody>
                    {
                        errors.map((tag) => (
                            <tr key={tag.qcode}>
                                <td>{tag.name}</td>
                                <td>{tag.qcode}</td>
                                <td>{tag.parent}</td>
                            </tr>
                        ))
                    }
                </tbody>
            </table>
        </Modal>
    ));
}

export function getAutoTaggingComponent(superdesk: ISuperdesk, label: string) {
    const {preferences} = superdesk;
    const {httpRequestJsonLocal} = superdesk;
    const {gettext, gettextPlural} = superdesk.localization;
    const {generatePatch, arrayToTree} = superdesk.utilities;
    const {AuthoringWidgetLayout, AuthoringWidgetHeading, Alert} = superdesk.components;
    const groupLabels = getGroups(superdesk);

    const TagListComponent = getTagsListComponent(superdesk);
    const NewItemComponent = getNewItemComponent(superdesk);

    return class AutoTagging extends React.PureComponent<IProps, IState> {
        private isDirty: (a: IAutoTaggingResponse, b: Partial<IAutoTaggingResponse>) => boolean;
        private _mounted: boolean;
        private iMatricsFields = superdesk.instance.config.iMatricsFields ?? {entities: {}, others: {}};

        constructor(props: IProps) {
            super(props);

            this.state = {
                data: 'not-initialized',
                newItem: null,
                runAutomaticallyPreference: 'loading',
                vocabularyLabels: null,
                showImagesPreference: false,
            };

            this._mounted = false;
            this.runAnalysis = this.runAnalysis.bind(this);
            this.initializeData = this.initializeData.bind(this);
            this.updateTags = this.updateTags.bind(this);
            this.createNewTag = this.createNewTag.bind(this);
            this.insertTagFromSearch = this.insertTagFromSearch.bind(this);
            this.reload = this.reload.bind(this);
            this.save = this.save.bind(this);
            this.isDirty = memoizeOne((a, b) => Object.keys(generatePatch(a, b)).length > 0);
        }
        runAnalysis() {
            const dataBeforeLoading = this.state.data;

            this.setState({data: 'loading'}, () => {
                const {guid, language, headline, body_html, abstract} = this.props.article;
                const tags = dataBeforeLoading !== 'not-initialized' && dataBeforeLoading !== 'loading' ?
                    dataBeforeLoading.changes.analysis :
                    OrderedMap<string, ITagUi>();

                httpRequestJsonLocal<{analysis: IServerResponse}>({
                    method: 'POST',
                    path: '/ai/',
                    payload: {
                        service: 'imatrics',
                        item: {
                            guid,
                            language,
                            headline,
                            body_html,
                            abstract,
                        },
                        tags: toServerFormat(tags, superdesk),
                    },
                }).then((res) => {
                    const resClient = toClientFormat(res.analysis);

                    if (this._mounted) {
                        this.setState({
                            data: {
                                original: dataBeforeLoading === 'loading' || dataBeforeLoading === 'not-initialized'
                                    ? {analysis: OrderedMap<string, ITagUi>()} // initialize empty data
                                    : dataBeforeLoading.original, // use previous data
                                changes: {analysis: resClient},
                            },
                        });
                    }
                });
            });
        }
        initializeData(preload: boolean) {
            const existingTags = getExistingTags(this.props.article);

            if (Object.keys(existingTags).length > 0) {
                const resClient = toClientFormat(existingTags);

                this.setState({
                    data: {original: {analysis: resClient}, changes: {analysis: resClient}},
                });
            } else if (preload) {
                this.runAnalysis();
            }
        }
        updateTags(tags: OrderedMap<string, ITagUi>, data: IEditableData) {
            const {changes} = data;

            this.setState({
                data: {
                    ...data,
                    changes: {
                        ...changes,
                        analysis: tags,
                    },
                },
            });
        }
        createNewTag(newItem: INewItem, data: IEditableData) {
            const _title = newItem.name;

            if (_title == null || newItem.group == null) {
                return;
            }

            const tag: ITagUi = {
                qcode: Math.random().toString(),
                name: _title,
                description: newItem.description,
                source: SOURCE_IMATRICS,
                altids: {},
                group: newItem.group,
            };

            this.updateTags(
                data.changes.analysis.set(tag.qcode, tag),
                data,
            );

            this.setState({newItem: null});
        }
        insertTagFromSearch(tag: ITagUi, data: IEditableData, searchResponse: IAutoTaggingSearchResult) {
            /**
             * Contains parents of all items returned in search results,
             * not only the one that was eventually chosen
             */
            const parentsMixed = searchResponse?.result?.broader != null
                ? toClientFormat(searchResponse.result.broader)
                : OrderedMap<string, ITagUi>();

            const parentsForChosenTag: Array<ITagUi> = [];

            let latestParent = tag;

            while (latestParent?.parent != null) {
                const nextParent = parentsMixed.get(latestParent.parent);

                if (nextParent != null) {
                    parentsForChosenTag.push(nextParent);
                }

                latestParent = nextParent;
            }

            let result: OrderedMap<string, ITagUi> = data.changes.analysis;

            result = result.set(tag.qcode, tag);

            for (const parent of parentsForChosenTag) {
                result = result.set(parent.qcode, parent);
            }

            this.updateTags(
                result,
                data,
            );
        }
        getGroupName(group: string, vocabularyLabels: Map<string, string>) {
            return this.iMatricsFields.others[group]?.name ?? vocabularyLabels?.get(group) ?? group;
        }
        reload() {
            this.setState({data: 'not-initialized'});

            this.initializeData(false);
        }
        save() {
            const {data} = this.state;

            if (data === 'loading' || data === 'not-initialized') {
                return;
            }

            superdesk.entities.article.patch(
                this.props.article,
                createTagsPatch(this.props.article, data.changes.analysis, superdesk),
            ).then(() => {
                this.reload();
                this.sendFeedback(this.props.article, data.changes.analysis);
            });
        }
        sendFeedback(article: IArticle, tags: IAutoTaggingResponse['analysis']): Promise<any> {
            const {guid, language, headline, body_html, abstract} = article;

            return httpRequestJsonLocal<{analysis: IServerResponse}>({
                method: 'POST',
                path: '/ai_data_op/',
                payload: {
                    service: 'imatrics',
                    operation: 'feedback',
                    data: {
                        item: {
                            guid,
                            language,
                            headline,
                            body_html,
                            abstract,
                        },
                        tags: toServerFormat(tags, superdesk),
                    },
                },
            });
        }
        componentDidMount() {
            this._mounted = true;
            Promise.all([
                getAutoTaggingVocabularyLabels(superdesk),
                preferences.get(RUN_AUTOMATICALLY_PREFERENCE),
                preferences.get(SHOW_IMAGES_PREFERENCE),
            ]).then(([vocabularyLabels, runAutomatically = false, showImages = false]) => {
                this.setState({
                    vocabularyLabels,
                    runAutomaticallyPreference: runAutomatically,
                    showImagesPreference: showImages,
                });

                this.initializeData(runAutomatically);
            });
        }
        componentWillUnmount() {
            this._mounted = false;
        }
        render() {
            const {runAutomaticallyPreference, vocabularyLabels, showImagesPreference} = this.state;

            if (runAutomaticallyPreference === 'loading' || vocabularyLabels == null) {
                return null;
            }

            const {data} = this.state;
            const dirty = data === 'loading' || data === 'not-initialized' ? false :
                this.isDirty(data.original, data.changes);

            const readOnly = superdesk.entities.article.isLockedInOtherSession(this.props.article);

            return (
                <AuthoringWidgetLayout
                    header={(
                        <AuthoringWidgetHeading
                            widgetId={AUTO_TAGGING_WIDGET_ID}
                            widgetName={label}
                            editMode={dirty}
                        >
                            {
                                data === 'loading' || data === 'not-initialized' || !dirty ? null : (
                                    <ButtonGroup align="end">
                                        <Button
                                            text={gettext('Save')}
                                            type="primary"
                                            onClick={this.save}
                                        />

                                        <Button
                                            text={gettext('Cancel')}
                                            onClick={this.reload}
                                        />
                                    </ButtonGroup>
                                )
                            }
                        </AuthoringWidgetHeading>
                    )}

                    body={(
                        <React.Fragment>
                            {
                                (() => {
                                    if (data === 'loading' || data === 'not-initialized') {
                                        return null;
                                    } else {
                                        const treeErrors = arrayToTree(
                                            data.changes.analysis.toArray(),
                                            (item) => item.qcode,
                                            (item) => item.parent,
                                        ).errors;

                                        // only show errors when there are unsaved changes
                                        if (treeErrors.length > 0 && dirty) {
                                            return (
                                                <div>
                                                    <Alert
                                                        type="warning"
                                                        size="small"
                                                        title={gettext('iMatrics service error')}
                                                        message={
                                                            gettextPlural(
                                                                treeErrors.length,
                                                                '1 tag can not be displayed',
                                                                '{{n}} tags can not be displayed',
                                                                {n: treeErrors.length},
                                                            )
                                                        }
                                                        actions={[
                                                            {
                                                                label: gettext('details'),
                                                                onClick: () => {
                                                                    showImatricsServiceErrorModal(
                                                                        superdesk,
                                                                        treeErrors,
                                                                    );
                                                                },
                                                                icon: 'info-sign',
                                                            },
                                                        ]}
                                                    />
                                                    <br />
                                                </div>
                                            );
                                        } else {
                                            return null;
                                        }
                                    }
                                })()
                            }

                            <div>
                                <div>
                                    <div className="form__row form__row--flex sd-padding-b--1">
                                        <ButtonGroup align="start">
                                            <Switch
                                                value={runAutomaticallyPreference}
                                                disabled={readOnly}
                                                onChange={() => {
                                                    const newValue = !runAutomaticallyPreference;

                                                    this.setState({runAutomaticallyPreference: newValue});

                                                    superdesk.preferences.set(
                                                        RUN_AUTOMATICALLY_PREFERENCE,
                                                        newValue,
                                                    );

                                                    if (newValue && this.state.data === 'not-initialized') {
                                                        this.runAnalysis();
                                                    }
                                                }}
                                                label={{content: gettext('Run automatically')}}
                                            />

                                            <Switch
                                                value={showImagesPreference}
                                                disabled={readOnly}
                                                onChange={() => {
                                                    const newValue = !showImagesPreference;

                                                    this.setState({showImagesPreference: newValue});
                                                    superdesk.preferences.set(SHOW_IMAGES_PREFERENCE, newValue);
                                                }}
                                                label={{content: gettext('Show image suggestions')}}
                                            />
                                        </ButtonGroup>
                                    </div>

                                    {
                                        data === 'loading' || data === 'not-initialized' ? null : (
                                            <div
                                                className="form__row form__row--flex"
                                                style={{alignItems: 'center'}}
                                            >
                                                <div style={{flexGrow: 1}}>
                                                    <Autocomplete
                                                        value={''}
                                                        keyValue="keyValue"
                                                        items={[]}
                                                        search={(searchString, callback) => {
                                                            let cancelled = false;

                                                            httpRequestJsonLocal<IAutoTaggingSearchResult>({
                                                                method: 'POST',
                                                                path: '/ai_data_op/',
                                                                payload: {
                                                                    service: 'imatrics',
                                                                    operation: 'search',
                                                                    data: {term: searchString},
                                                                },
                                                            }).then((res) => {
                                                                if (cancelled !== true) {
                                                                    const result =
                                                                        toClientFormat(res.result.tags).toArray();

                                                                    const withoutExistingTags = result.filter(
                                                                        (searchTag) => tagAlreadyExists(
                                                                            data,
                                                                            searchTag.qcode,
                                                                        ) !== true,
                                                                    );

                                                                    const withResponse = withoutExistingTags.map(
                                                                        (tag) => ({
                                                                            // required for Autocomplete component
                                                                            keyValue: tag.name,

                                                                            tag,

                                                                            // required to be able to
                                                                            // get all parents
                                                                            // when an item is selected
                                                                            entireResponse: res,
                                                                        }),
                                                                    );

                                                                    callback(withResponse);
                                                                }
                                                            });

                                                            return {
                                                                cancel: () => {
                                                                    cancelled = true;
                                                                },
                                                            };
                                                        }}
                                                        listItemTemplate={(__item: any) => {
                                                            const _item: ITagUi = __item.tag;

                                                            return (
                                                                <div
                                                                    className={
                                                                        'auto-tagging-widget__autocomplete-item'
                                                                    }
                                                                >
                                                                    <b>{_item.name}</b>

                                                                    {
                                                                        _item?.group?.value == null ? null : (
                                                                            <p>{_item.group.value}</p>
                                                                        )
                                                                    }

                                                                    {
                                                                        _item?.description == null ? null : (
                                                                            <p>{_item.description}</p>
                                                                        )
                                                                    }
                                                                </div>
                                                            );
                                                        }}
                                                        onSelect={(_value: any) => {
                                                            const tag: ITagUi = _value.tag;
                                                            const entireResponse: IAutoTaggingSearchResult =
                                                                _value.entireResponse;

                                                            this.insertTagFromSearch(tag, data, entireResponse);
                                                            // TODO: clear autocomplete?
                                                        }}
                                                        onChange={noop}
                                                    />
                                                </div>

                                                <div style={{marginInlineStart: 10, marginBlockStart: 14}}>
                                                    <Button
                                                        type="primary"
                                                        icon="plus-large"
                                                        size="small"
                                                        shape="round"
                                                        text={gettext('Add')}
                                                        iconOnly={true}
                                                        disabled={readOnly}
                                                        onClick={() => {
                                                            this.setState({
                                                                newItem: {
                                                                    name: '',
                                                                },
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    }
                                </div>

                                {(() => {
                                    if (data === 'loading') {
                                        return (
                                            <div style={{display: 'flex', alignItems: 'center'}}>
                                                <div className="spinner-big" />
                                            </div>
                                        );
                                    } else if (data === 'not-initialized') {
                                        return (
                                            <EmptyState
                                                title={gettext('No tags yet')}
                                                description={
                                                    readOnly ?
                                                        undefined
                                                        : gettext('Click "Run" to generate')
                                                }
                                            />
                                        );
                                    } else {
                                        const {
                                            entitiesGroupedAndSorted,
                                            othersGrouped,
                                        } = getAutoTaggingData(data, this.iMatricsFields);

                                        const savedTags = data.original.analysis.keySeq().toSet();

                                        let allGrouped = OrderedMap<string, JSX.Element>();

                                        othersGrouped.forEach((tags, groupId) => {
                                            if (tags != null && groupId != null) {
                                                allGrouped = allGrouped.set(groupId,
                                                    <ToggleBoxNext
                                                        key={groupId}
                                                        title={this.getGroupName(groupId, vocabularyLabels)}
                                                        style="circle"
                                                        isOpen={true}
                                                    >
                                                        <TagListComponent
                                                            savedTags={savedTags}
                                                            tags={tags.toMap()}
                                                            readOnly={readOnly}
                                                            onRemove={(ids) => {
                                                                this.updateTags(
                                                                    ids.reduce(
                                                                        (analysis, id) => analysis.remove(id),
                                                                        data.changes.analysis,
                                                                    ),
                                                                    data,
                                                                );
                                                            }}
                                                        />
                                                    </ToggleBoxNext>,
                                                );
                                            }
                                        });

                                        if (entitiesGroupedAndSorted.size > 0) {
                                            allGrouped = allGrouped.set('entities',
                                                <ToggleBoxNext
                                                    title={this.getGroupName('entities', vocabularyLabels)}
                                                    style="circle"
                                                    isOpen={true}
                                                    key="entities"
                                                >
                                                    {entitiesGroupedAndSorted.map((tags, key) => (
                                                        <div key={key}>
                                                            <div
                                                                className="form-label"
                                                                style={{display: 'block'}}
                                                            >
                                                                {groupLabels.get(key).plural}
                                                            </div>
                                                            <TagListComponent
                                                                savedTags={savedTags}
                                                                tags={tags.toMap()}
                                                                readOnly={readOnly}
                                                                onRemove={(ids) => {
                                                                    this.updateTags(
                                                                        ids.reduce(
                                                                            (analysis, id) => analysis.remove(id),
                                                                            data.changes.analysis,
                                                                        ),
                                                                        data,
                                                                    );
                                                                }}
                                                            />
                                                        </div>
                                                    )).toArray()}
                                                </ToggleBoxNext>,
                                            );
                                        }

                                        const allGroupedAndSortedByConfig = allGrouped
                                            .filter((_, key) => hasConfig(key, this.iMatricsFields.others))
                                            .sortBy((_, key) => this.iMatricsFields.others[key].order,
                                                (a, b) => a - b);

                                        const allGroupedAndSortedNotInConfig = allGrouped
                                            .filter((_, key) => !hasConfig(key, this.iMatricsFields.others));

                                        const allGroupedAndSorted = allGroupedAndSortedByConfig
                                            .concat(allGroupedAndSortedNotInConfig);

                                        return (
                                            <React.Fragment>
                                                {
                                                    this.state.newItem == null ? null : (
                                                        <NewItemComponent
                                                            item={this.state.newItem}
                                                            onChange={(newItem) => {
                                                                this.setState({newItem});
                                                            }}
                                                            save={(newItem: INewItem) => {
                                                                this.createNewTag(newItem, data);
                                                            }}
                                                            cancel={() => {
                                                                this.setState({newItem: null});
                                                            }}
                                                            tagAlreadyExists={
                                                                (qcode) => tagAlreadyExists(data, qcode)
                                                            }
                                                        />
                                                    )
                                                }

                                                <div className="widget-content__main">
                                                    {allGroupedAndSorted.map((item) => item).toArray()}

                                                    {this.state.showImagesPreference && (
                                                        <ImageTagging
                                                            data={data.changes.analysis}
                                                            article={this.props.article}
                                                        />
                                                    )}
                                                </div>
                                            </React.Fragment>
                                        );
                                    }
                                })()}
                            </div>
                        </React.Fragment>
                    )}
                    footer={
                        (() => {
                            if (data === 'loading') {
                                return undefined;
                            } else if (data === 'not-initialized') {
                                return (
                                    <Button
                                        type="primary"
                                        text={gettext('Run')}
                                        expand={true}
                                        disabled={readOnly}
                                        onClick={() => {
                                            this.runAnalysis();
                                        }}
                                    />
                                );
                            } else {
                                return (
                                    <Button
                                        type="primary"
                                        text={gettext('Refresh')}
                                        expand={true}
                                        disabled={readOnly}
                                        onClick={() => {
                                            this.runAnalysis();
                                        }}
                                    />
                                );
                            }
                        })()
                    }
                />
            );
        }
    };
}
