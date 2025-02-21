import React from 'react';
import ng from 'core/services/ng';
import {IArticle} from 'superdesk-api';

interface IProps {
    item: IArticle;
    wrapperTemplate: React.ComponentType<{children: Array<JSX.Element>}>;
    translationTemplate: React.ComponentType<{translation: IArticle, getTranslatedFromLanguage: () => string}>;
    initialState?: IState;
}

interface IState {
    translations: Array<IArticle> | null;
    translationsLookup: Dictionary<IArticle['_id'], IArticle>;
}

export class TranslationsBody extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = this.props.initialState ?? {
            translations: null,
            translationsLookup: {},
        };
    }

    componentDidMount() {
        if (this.props.initialState != null) {
            return;
        }

        const {item} = this.props;

        ng.get('TranslationService').getTranslations(item)
            .then((response) => {
                const translations: Array<IArticle> = response._items;

                this.setState({
                    translations: translations,
                    translationsLookup: translations.reduce((result, reference) => {
                        result[reference._id] = reference;
                        return result;
                    }, {}),
                });
            });
    }

    render(): React.ReactNode {
        if (this.state?.translations == null || this.state?.translationsLookup == null) {
            return null;
        }

        const sortOldestFirst = (a: IArticle, b: IArticle) =>
            new Date(b.firstcreated) > new Date(a.firstcreated) ? -1 : 1;
        const WrapperTemplate = this.props.wrapperTemplate;
        const TranslationTemplate = this.props.translationTemplate;

        return (
            <WrapperTemplate>
                {
                    this.state.translations.sort(sortOldestFirst).map((translation: IArticle, i) => {
                        return (
                            <TranslationTemplate
                                key={i}
                                translation={translation}
                                getTranslatedFromLanguage={
                                    () => this.state.translationsLookup[translation.translated_from]?.language
                                }
                            />
                        );
                    })
                }
            </WrapperTemplate>
        );
    }
}
