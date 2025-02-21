/* eslint-disable react/no-multi-comp */
import React from 'react';
import classNames from 'classnames';
import {IAuthoringFieldV2, IEditorComponentContainerProps, IPropsAuthoringFieldTemplate} from 'superdesk-api';
import {Switch} from 'superdesk-ui-framework/react';
import {gettext} from 'core/utils';
import {Spacer, SpacerBlock} from 'core/ui/components/Spacer';

export const RequiredIndicatorForHeader = () => (
    <span
        className="sd-font-size--x-small"
        style={{color: 'var(--sd-colour-alert)'}}
    >
        *
    </span>
);

export const RequiredIndicatorForContent = () => (
    <span
        style={{
            fontSize: 'var(--text-size--base)',
            fontStyle: 'italic',
        }}
    >
        {gettext('Required')}
    </span>
);

export interface IGetFieldContainerOptions {
    useHeaderLayout: boolean,
    canBeToggled: boolean,
    field: IAuthoringFieldV2,
    toggledOn: boolean,
    toggleField: (fieldId: string) => void,
    validationError?: string,
    fieldTemplate: React.ComponentType<IPropsAuthoringFieldTemplate> | null;
}

export function getFieldContainer(options: IGetFieldContainerOptions) {
    const {
        useHeaderLayout,
        canBeToggled,
        field,
        toggledOn,
        toggleField,
        validationError,
    } = options;

    const FieldTemplate = options.fieldTemplate;

    if (FieldTemplate != null) {
        class Component extends React.PureComponent<IEditorComponentContainerProps> {
            render() {
                return (
                    <FieldTemplate
                        field={field}
                        input={this.props.children}
                        validationError={validationError}
                        miniToolbar={this.props.miniToolbar}
                    />
                );
            }
        }

        return Component;
    }

    const toggle = canBeToggled && (
        <Switch
            label={{content: gettext('Toggle field')}}
            value={toggledOn}
            onChange={() => {
                toggleField(field.id);
            }}
        />
    );


    class HeaderLayout extends React.PureComponent<IEditorComponentContainerProps> {
        render() {
            const {miniToolbar} = this.props;

            return (
                <Spacer v gap="0">
                    <span
                        className={classNames(
                            'form-label',
                            {'form-label--invalid': validationError != null},
                        )}
                    >
                        <Spacer h gap="8" noGrow noWrap>
                            <Spacer h gap="4" noGrow noWrap>
                                {field.name}
                                {field.fieldConfig.required && (
                                    <RequiredIndicatorForHeader />
                                )}
                            </Spacer>
                            <span>{toggle}</span>
                        </Spacer>
                    </span>

                    <div style={{flexGrow: 1}}>
                        {this.props.children}

                        <Spacer h gap="8" justifyContent="end" noGrow noWrap>
                            {
                                validationError != null && (
                                    <div className="input-field-error">{validationError}</div>
                                )
                            }

                            {
                                miniToolbar != null && (
                                    <div>{miniToolbar}</div>
                                )
                            }
                        </Spacer>
                    </div>
                </Spacer>
            );
        }
    }

    class ContentLayout extends React.PureComponent<IEditorComponentContainerProps> {
        render() {
            const {miniToolbar} = this.props;

            return (
                <div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Spacer h gap="8" noGrow>
                            <Spacer h gap="8" noGrow noWrap>
                                <span
                                    className={classNames(
                                        'field-label--base',
                                        {'field-label--base--invalid': validationError != null},
                                    )}
                                >
                                    {field.name}
                                </span>

                                {field.fieldConfig.required && (
                                    <RequiredIndicatorForContent />
                                )}
                            </Spacer>

                            <span>{toggle}</span>
                        </Spacer>

                        {
                            miniToolbar != null && (
                                <div>{miniToolbar}</div>
                            )
                        }
                    </div>

                    <SpacerBlock v gap="4" />

                    {
                        validationError != null && (
                            <div className="input-field-error">{validationError}</div>
                        )
                    }

                    <SpacerBlock v gap="8" />

                    {this.props.children}
                </div>
            );
        }
    }

    const Container = useHeaderLayout ? HeaderLayout : ContentLayout;

    return Container;
}
