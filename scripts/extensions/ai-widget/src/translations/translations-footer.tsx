import React, {ReactNode} from 'react';
import {IRestApiResponse, ITranslation} from 'superdesk-api';
import {Spacer, Button, TreeSelect, Text, SpacerBlock} from 'superdesk-ui-framework/react';
import {IStateTranslationsTab, ITranslationLanguage} from '../ai-assistant';
import {superdesk} from '../superdesk';

interface IProps {
    setActiveLanguage: (language: ITranslationLanguage) => void;
    activeLanguageId: ITranslationLanguage;
    generateTranslations: () => void;
    mode: IStateTranslationsTab['mode'];
}

type ITranslationLanguageWithLabel = Pick<ITranslation, '_id' | 'label'>;

interface IState {
    languages: Array<{_id: string; label: string}>;
}

export default class TranslationFooter extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            languages: [],
        };
    }

    componentDidMount(): void {
        superdesk.httpRequestJsonLocal<IRestApiResponse<ITranslationLanguageWithLabel>>({
            method: 'GET',
            path: '/languages',
        }).then((response) => {
            this.setState({
                languages: response._items,
            });
        });
    }

    render(): ReactNode {
        const {gettext} = superdesk.localization;
        const {activeLanguageId, setActiveLanguage, generateTranslations} = this.props;

        const availableLanguages = this.state.languages;
        const activeLanguageValue = availableLanguages.find((x) => x._id === activeLanguageId);

        if (Object.keys(availableLanguages ?? {}).length < 1) {
            return (
                <Text>
                    {gettext('Languages are not available.')}
                </Text>
            );
        }

        if (activeLanguageValue == null) {
            throw new Error('Languages are broken');
        }

        return (
            <>
                <SpacerBlock v gap="16" />
                <Spacer h gap="8" justifyContent="space-between" alignItems="end">
                    <TreeSelect
                        getId={({_id}) => _id}
                        valueTemplate={({label}) => <span>{gettext('To: {{ language }}', {language: label})}</span>}
                        getLabel={({label}) => label}
                        getOptions={() => availableLanguages.map((language) => ({value: language}))}
                        kind="synchronous"
                        onChange={(value) => {
                            setActiveLanguage(value[0]._id);
                        }}
                        value={[{_id: activeLanguageValue._id, label: activeLanguageValue.label}]}
                        inlineLabel
                        labelHidden
                        fullWidth
                        required
                    />
                    <Button
                        expand
                        onClick={generateTranslations}
                        text={gettext('Translate')}
                        style="hollow"
                    />
                </Spacer>
            </>
        );
    }
}
