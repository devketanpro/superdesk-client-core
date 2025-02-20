import {IExtensionActivationResult, IAuthoringAction} from 'superdesk-api';
import {appConfig} from 'appConfig';
import {gettext} from 'core/utils';
import {runTansa} from '../editor3-tansa-integration';
import {getEditor3Field} from './editor3';
import {registerInternalExtension} from 'core/helpers/register-internal-extension';
import {getDropdownField} from './dropdown';
import {getDateField} from './date';
import {getUrlsField} from './urls';
import {getEmbedField} from './embed';
import {getMediaField} from './media';
import {getLinkedItemsField} from './linked-items';
import {getAttachmentsField} from './attachments';
import {getTimeField} from './time';
import {geDurationField} from './duration';
import {getArticlesInPackageField} from './package-items';
import {getTagInputField} from './tag-input';
import {getDatelineField} from './dateline';
import {getDatetimeField} from './datetime';
import {getBooleanField} from './boolean';

export const AUTHORING_REACT_FIELDS = 'authoring-react--fields';

export function registerAuthoringReactFields() {
    const result: IExtensionActivationResult = {
        contributions: {
            getAuthoringActions: (article, contentProfile, fieldsData) => {
                if (appConfig.features.useTansaProofing === true) {
                    const checkSpellingAction: IAuthoringAction = {
                        label: gettext('Check spelling'),
                        onTrigger: () => {
                            runTansa(contentProfile, fieldsData);
                        },
                        keyBindings: {
                            'ctrl+shift+y': () => {
                                runTansa(contentProfile, fieldsData);
                            },
                        },
                    };

                    return [checkSpellingAction];
                } else {
                    return [];
                }
            },
            customFieldTypes: [
                getEditor3Field(),
                getDropdownField(),
                getDateField(),
                getDatetimeField(),
                getTimeField(),
                geDurationField(),
                getUrlsField(),
                getEmbedField(),
                getMediaField(),
                getLinkedItemsField(),
                getAttachmentsField(),
                getArticlesInPackageField(),
                getTagInputField(),
                getDatelineField(),
                getBooleanField(),
            ],
        },
    };

    registerInternalExtension(AUTHORING_REACT_FIELDS, result);
}
