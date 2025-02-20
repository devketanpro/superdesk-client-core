import React from 'react';
import ReactDOM from 'react-dom';
import {ModalPrompt} from 'core/ui/components/Modal/ModalPrompt';
import {gettext} from 'core/utils';
import {showModal} from '@superdesk/common';
import {Button, Modal} from 'superdesk-ui-framework/react';

function prepareAndPrint() {
    document.body.classList.add('prepare-to-print');

    const afterPrintFns: Array<() => void> = [
        () => document.body.classList.remove('prepare-to-print'),
    ];

    const afterPrint = () => {
        afterPrintFns.forEach((fn) => fn());
    };

    if (window.matchMedia) {
        var mediaQueryList = window.matchMedia('print');

        const handler = (mql) => {
            if (!mql.matches) {
                afterPrint();
            }
        };

        mediaQueryList.addListener(handler);
        afterPrintFns.push(() => mediaQueryList.removeListener(handler));
    }

    window.onafterprint = afterPrint;

    window.print();
}

export interface IPropsPrintableModal {
    closeModal(): void;
    showPrintDialog(): void;
    Wrapper: React.ComponentType<{toolbar: React.ReactNode, contentSections: Array<React.ReactNode>}>;
}

const pageBreak = (
    <div>
        <div style={{pageBreakAfter: 'always'}} />
        <hr className="no-print" />
    </div>
);

/*
 * Usage example:
    <Wrapper
        toolbar={(
            <button onClick={showPrintDialog}>print</button>
        )}
        contentSections={[
            <div>printable content goes here</div>,
            <div>each content section starts on a new page</div>,
        ]}
    />
 */
export function showPrintableModal(
    Component: React.ComponentType<IPropsPrintableModal>,
) {
    showModal(({closeModal}) => {
        return (
            <Component
                Wrapper={({toolbar, contentSections}) => (
                    <div className="sd-full-preview">
                        <div className="sd-full-preview--header no-print">
                            {toolbar}
                        </div>

                        <div className="sd-full-preview--content-wrapper">
                            {
                                contentSections.map((section, i) => {
                                    return (
                                        <div key={i}>
                                            { // always start a new article on a new page in print mode
                                                i > 0 && pageBreak
                                            }

                                            <div className="sd-full-preview--content">
                                                {section}
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                )}
                closeModal={closeModal}
                showPrintDialog={() => prepareAndPrint()}
            />
        );
    }, 'print-container');
}

function getErrorsModal(
    title: string,
    errors: Array<string>,
    description?: string,
) {
    return class ErrorsModal extends React.PureComponent<{closeModal(): void}> {
        render() {
            return (
                <Modal
                    visible
                    size="small"
                    position="top"
                    onHide={this.props.closeModal}
                    headerTemplate={title}
                    footerTemplate={
                        <Button type="primary" text={gettext('Ok')} onClick={this.props.closeModal} />
                    }
                >
                    {
                        description == null ? null : (
                            <h3>{description}</h3>
                        )
                    }

                    {
                        errors.map((message, i) => (
                            <p key={i}>{message}</p>
                        ))
                    }
                </Modal>
            );
        }
    };
}

export function showErrorsModal(
    title: string,
    errors: Array<string>,
) {
    showModal(getErrorsModal(title, errors));
}

export default angular.module('superdesk.core.services.modal', [
    'superdesk-ui',
    'superdesk.core.services.asset',
    'superdesk.core.translate',
])
    .service('modal', ['$q', '$modal', '$sce', 'asset', function($q, $modal, $sce, asset) {
        const defaults = {
            bodyText: '',
            headerText: gettext('Confirm'),
            okText: gettext('OK'),
            cancelText: gettext('Cancel'),
            additionalCancelText: null,
        };

        function confirmArgumentsList(
            bodyText = defaults.bodyText,
            headerText = defaults.headerText,
            okText = defaults.okText,
            cancelText = defaults.cancelText,
            additionalCancelText = defaults.additionalCancelText,
        ) {
            return confirmBase(bodyText, headerText, okText, cancelText, additionalCancelText);
        }

        function confirmConfigurationObject(options) {
            const nextOptions = {...defaults, ...options};

            return confirmBase(
                nextOptions.bodyText,
                nextOptions.headerText,
                nextOptions.okText,
                nextOptions.cancelText,
                nextOptions.additionalCancelText,
            );
        }

        function confirmBase(
            bodyText,
            headerText,
            okText,
            cancelText,
            additionalCancelText,
        ) {
            var delay = $q.defer();

            $modal.open({
                templateUrl: asset.templateUrl('core/views/confirmation-modal.html'),
                controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
                    $scope.headerText = $sce.trustAsHtml(headerText);
                    $scope.bodyText = $sce.trustAsHtml(bodyText);
                    $scope.okText = okText;
                    $scope.cancelText = cancelText;
                    $scope.additionalCancelText = additionalCancelText;

                    $scope.ok = function() {
                        delay.resolve(true);
                        $modalInstance.close();
                    };

                    $scope.cancel = function() {
                        delay.reject();
                        $modalInstance.dismiss();
                    };

                    $scope.additionalCancel = function() {
                        $modalInstance.dismiss();
                    };

                    $scope.close = function() {
                        $modalInstance.dismiss();
                    };
                }],
            });

            return delay.promise;
        }

        this.confirm = function() {
            // eslint-disable-next-line prefer-rest-params
            if (typeof arguments[0] === 'object' && arguments.length === 1) {
                // eslint-disable-next-line prefer-rest-params
                return confirmConfigurationObject.apply(this, arguments);
            } else {
                // eslint-disable-next-line prefer-rest-params
                return confirmArgumentsList.apply(this, arguments);
            }
        };

        this.alert = function(options) {
            return confirmConfigurationObject.call(this, {...options, cancelText: null});
        };

        this.createCustomModal = function(dataTestId) {
            return new Promise((resolve) => {
                $modal.open({
                    template: `<div id="custom-modal-placeholder" data-test-id="${dataTestId}"></div>`,
                    controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
                        resolve({
                            openModal: (reactComponent) => {
                                setTimeout(() => {
                                    ReactDOM.render(
                                        reactComponent,
                                        document.querySelector('#custom-modal-placeholder'),
                                    );
                                });
                            },
                            closeModal: () => {
                                $modalInstance.close();
                                ReactDOM.unmountComponentAtNode(
                                    document.querySelector('#custom-modal-placeholder'),
                                );
                            },
                        });
                    }],
                });
            });
        };

        this.prompt = function(title, initialValue) {
            return new Promise((resolve, reject) => {
                this.createCustomModal()
                    .then(({openModal, closeModal}) => {
                        openModal(
                            <ModalPrompt
                                title={title}
                                initialValue={initialValue}
                                onSubmit={(value) => {
                                    closeModal();
                                    resolve(value);
                                }}
                                close={closeModal}
                            />,
                        );
                    });
            });
        };
    }]);
