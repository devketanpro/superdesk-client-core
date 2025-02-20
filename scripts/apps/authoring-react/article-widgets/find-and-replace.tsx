import React from 'react';
import {IArticleSideWidget, IArticleSideWidgetComponentType} from 'superdesk-api';
import {gettext} from 'core/utils';
import {AuthoringWidgetHeading} from 'apps/dashboard/widget-heading';
import {AuthoringWidgetLayout} from 'apps/dashboard/widget-layout';
import {Input, Button, IconButton, Switch} from 'superdesk-ui-framework/react';
import {dispatchEditorEvent} from '../authoring-react-editor-events';
import {Spacer} from 'core/ui/components/Spacer';
import {throttle} from 'lodash';

// Can't call `gettext` in the top level
const getLabel = () => gettext('Find and Replace');
const FIND_AND_REPLACE_WIDGET_ID = 'find-and-replace-widget';

interface IState {
    findValue: string;
    replaceValue: string;
    caseSensitive: boolean;
}

/**
 * Current implementation of find-replace only supports one field.
 */
export const editorId = 'body_html';

class FindAndReplaceWidget extends React.PureComponent<IArticleSideWidgetComponentType, IState> {
    private scheduleHighlightingOfMatches: () => void;

    constructor(props: IArticleSideWidgetComponentType) {
        super(props);

        this.state = this.props.initialState ?? {
            findValue: '',
            replaceValue: '',
            caseSensitive: false,
        };

        this.highlightMatches.bind(this);

        this.scheduleHighlightingOfMatches = throttle(
            this.highlightMatches,
            500,
            {leading: false},
        );
    }

    private highlightMatches() {
        dispatchEditorEvent('find_and_replace__find', {
            editorId,
            text: this.state.findValue,
            caseSensitive: this.state.caseSensitive,
        });
    }

    componentWillUnmount() {
        // remove highlights from editor
        dispatchEditorEvent('find_and_replace__find', {
            editorId,
            text: '',
            caseSensitive: false,
        });
    }

    render() {
        return (
            <AuthoringWidgetLayout
                header={(
                    <AuthoringWidgetHeading
                        widgetId={FIND_AND_REPLACE_WIDGET_ID}
                        widgetName={getLabel()}
                        editMode={false}
                    />
                )}
                body={(
                    <Spacer v gap="16">
                        <Input
                            type="text"
                            label={gettext('Find')}
                            value={this.state.findValue}
                            onChange={(findValue) => {
                                this.setState({findValue});
                                this.scheduleHighlightingOfMatches();
                            }}
                        />

                        <Input
                            type="text"
                            label={gettext('Replace with')}
                            value={this.state.replaceValue}
                            onChange={(replaceValue) => {
                                this.setState({replaceValue});
                            }}
                        />

                        <Switch
                            label={{content: gettext('Case sensitive'), side: 'right'}}
                            value={this.state.caseSensitive}
                            onChange={(caseSensitive) => {
                                this.setState({caseSensitive});
                                this.scheduleHighlightingOfMatches();
                            }}
                        />

                        <div className="space-between">
                            <Spacer h gap="4" justifyContent="start" noGrow>
                                <IconButton
                                    ariaValue={gettext('Previous match')}
                                    onClick={() => {
                                        dispatchEditorEvent('find_and_replace__find_prev', {editorId});
                                    }}
                                    icon="chevron-left-thin"
                                />

                                <IconButton
                                    ariaValue={gettext('Next match')}
                                    onClick={() => {
                                        dispatchEditorEvent('find_and_replace__find_next', {editorId});
                                    }}
                                    icon="chevron-right-thin"
                                />
                            </Spacer>

                            <Spacer h gap="4" justifyContent="start" noGrow>
                                <Button
                                    text={gettext('Replace')}
                                    onClick={() => {
                                        dispatchEditorEvent('find_and_replace__replace', {
                                            editorId,
                                            replaceWith: this.state.replaceValue,
                                            replaceAllMatches: false,
                                        });

                                        setTimeout(() => {
                                            this.highlightMatches();
                                        });
                                    }}
                                    disabled={(this.state.replaceValue ?? '').trim().length < 1}
                                />

                                <Button
                                    text={gettext('Replace all')}
                                    onClick={() => {
                                        dispatchEditorEvent('find_and_replace__replace', {
                                            editorId,
                                            replaceWith: this.state.replaceValue,
                                            replaceAllMatches: true,
                                        });

                                        setTimeout(() => {
                                            this.highlightMatches();
                                        });
                                    }}
                                    disabled={this.state.replaceValue?.trim().length < 1}
                                />
                            </Spacer>
                        </div>
                    </Spacer>
                )}
            />
        );
    }
}

export function getFindAndReplaceWidget() {
    const metadataWidget: IArticleSideWidget = {
        _id: FIND_AND_REPLACE_WIDGET_ID,
        label: getLabel(),
        order: 1,
        icon: 'find-replace',
        component: FindAndReplaceWidget,
    };

    return metadataWidget;
}
