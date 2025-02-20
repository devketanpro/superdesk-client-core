/* eslint-disable react/no-multi-comp */
/* eslint-disable react/display-name */
import React from 'react';
import {IArticle, IAuthoringActionType, ITopBarWidget} from 'superdesk-api';
import {flatMap} from 'lodash';
import {extensions} from 'appConfig';
import {dataApi} from 'core/helpers/CrudManager';
import {CreatedInfo} from './created-info';
import {ModifiedInfo} from './modified-info';
import {AuthoringToolbar} from 'apps/authoring-react/subcomponents/authoring-toolbar';

const getDefaultToolbarItems = (item: IArticle): Array<ITopBarWidget<IArticle>> => [{
    availableOffline: true,
    component: () => (
        <CreatedInfo
            entity={item}
        />
    ),
    group: 'start',
    priority: 1,
}, {
    availableOffline: true,
    component: () => (
        <ModifiedInfo
            entity={item}
        />
    ),
    group: 'start',
    priority: 2,
}];

interface IProps {
    article: IArticle;
    action: IAuthoringActionType;
    onChange(article: IArticle): void;
}

interface IState {
    articleOriginal?: IArticle;
}

/**
 * Only used from angular based authoring view
 */
export class AuthoringTopbar2React extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {};

        this.fetchArticleFromServer = this.fetchArticleFromServer.bind(this);
    }
    fetchArticleFromServer() {
        // fetching original item from the server since `IProps['article']` contains changes
        // which it shouldn't contain since it is in read-only mode.
        // I've tried passing `origItem` from authoring-topbar, but it contains changes as well,
        // namely `_editable` and `_locked` fields which doesn't allow for computing correct diff.
        dataApi.findOne<IArticle>('archive', this.props.article._id).then((articleOriginal) => {
            this.setState({articleOriginal});
        });
    }
    componentDidUpdate(prevProps: IProps) {
        if (this.props.action === 'view' && JSON.stringify(prevProps.article) !== JSON.stringify(this.props.article)) {
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({articleOriginal: undefined}, () => {
                this.fetchArticleFromServer();
            });
        }
    }
    componentDidMount() {
        if (this.props.action === 'view') {
            this.fetchArticleFromServer();
        }
    }
    render() {
        if (this.props.action === 'view' && typeof this.state.articleOriginal === 'undefined') {
            return null; // fetching article from the server
        }

        const articleDisplayWidgets = getDefaultToolbarItems(this.props.article).concat(
            flatMap(
                Object.values(extensions),
                (extension) => extension.activationResult?.contributions?.authoringTopbar2Widgets ?? [],
            ),
        );

        // extensions should be able to expose pure components which check equality by reference
        const articleUpdatedReference = {...this.props.article};

        return (
            <AuthoringToolbar
                entity={articleUpdatedReference}
                widgets={articleDisplayWidgets}
            />
        );
    }
}
