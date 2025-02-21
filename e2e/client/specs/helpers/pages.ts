/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable newline-per-chained-call */

import {element, by, browser, $, $$, promise as wdpromise, ElementFinder} from 'protractor';
import './waitReady';
export {authoring} from './authoring';
export {content} from './content';
import {click} from './utils';

export class LoginModal {
    username: any;
    password: any;
    btn: any;
    error: any;
    login: (username: any, password: any) => any;

    constructor() {
        this.username = element(by.model('username'));
        this.password = element(by.id('login-password'));
        this.btn = element(by.id('login-btn'));
        this.error = element(by.css('p.error'));

        this.login = function(username, password) {
            var self = this;
            let usr = username || browser.params.username;
            let pwd = password || browser.params.password;

            return self.username.waitReady()
                .then(() => self.username.clear())
                .then(() => self.username.sendKeys(usr))
                .then(() => self.password.sendKeys(pwd))
                .then(() => self.btn.click());
        };
    }
}

export const login = LoginModal;

class SearchProvider {
    checkbox: any;
    addSourceButton: any;
    addProvider: (providerType: any, source: any, isDefault: any) => void;
    openAddProvider: () => wdpromise.Promise<void>;
    selectProviderType: (providerType) => wdpromise.Promise<void>;
    setProviderSource: (source) => void;
    setIsDefault: (isDefault) => void;
    saveProvider: () => void;
    editProvider: (index: any) => void;
    closeEditNoSave: () => void;

    constructor() {
        var self = this;

        this.checkbox = element(by.model('provider.is_default'));
        this.addSourceButton = element(by.css('[ng-click="edit()"]'));

        this.addProvider = function(providerType, source, isDefault) {
            self.openAddProvider();
            self.selectProviderType(providerType);
            self.setProviderSource(source);
            self.setIsDefault(isDefault);
            self.saveProvider();
        };

        this.editProvider = function(index) {
            var providerElement = element.all(by.repeater('provider in providers')).get(index);

            browser.actions().mouseMove(providerElement).perform();
            providerElement.element(by.css('[ng-click="edit(provider)"]')).click();
        };

        this.closeEditNoSave = function() {
            element.all(by.css('[ng-click="cancel()"]')).first().click();
        };

        this.openAddProvider = function() {
            return self.addSourceButton.click();
        };

        this.selectProviderType = function(providerType) {
            element(by.model('provider.search_provider')).click();
            return element(by.cssContainingText('option', providerType)).click();
        };

        this.setProviderSource = function(source) {
            element(by.model('provider.source')).sendKeys(source);
        };

        this.saveProvider = function() {
            element(by.css('[ng-click="save()"]')).click();
        };

        this.setIsDefault = function(isDefault) {
            self.checkbox.isSelected().then((selected) => {
                if (selected && !isDefault || !selected && isDefault) {
                    self.checkbox.click();
                }
            });
        };
    }
}

class IngestDashboard {
    dropDown: any;
    ingestDashboard: ElementFinder;
    openDropDown: () => any;
    getProviderList: () => any;
    getProvider: (index: any) => any;
    getProviderButton: (provider: any) => any;
    getDashboardList: () => any;
    getDashboard: (index: any) => any;
    getDashboardSettingsButton: (dashboard: any) => any;
    getDashboardSettingsStatusButton: (settings: any) => any;
    getDashboardStatus: (dashboard: any) => any;
    getDashboardSettingsIngestCountButton: (settings: any) => any;
    getDashboardIngestCount: (dashboard: any) => any;

    constructor() {
        var self = this;

        this.dropDown = element(by.id('ingest-dashboard-dropdown'));
        this.ingestDashboard = element(by.css('.ingest-dashboard-list'));

        this.openDropDown = function() {
            return self.dropDown.click();
        };

        this.getProviderList = function() {
            return self.dropDown.all(by.repeater('item in items'));
        };

        this.getProvider = function(index) {
            return self.getProviderList().get(index);
        };

        this.getProviderButton = function(provider) {
            var toggleButton = provider.element(by.model('item.dashboard_enabled'));

            return toggleButton;
        };

        this.getDashboardList = function() {
            return self.ingestDashboard.all(by.repeater('item in items track by item._id'));
        };

        this.getDashboard = function(index) {
            return self.getDashboardList().get(index);
        };

        this.getDashboardSettingsButton = function(dashboard) {
            return dashboard.element(by.css('.dropdown'));
        };

        this.getDashboardSettingsStatusButton = function(settings) {
            return settings.element(by.model('item.show_status'));
        };

        this.getDashboardStatus = function(dashboard) {
            return dashboard.element(by.className('status'));
        };

        this.getDashboardSettingsIngestCountButton = function(settings) {
            return settings.element(by.model('item.show_ingest_count'));
        };

        this.getDashboardIngestCount = function(dashboard) {
            return dashboard.element(by.className('ingested-count'));
        };
    }
}

/**
 * Constructor for the "class" representing the ingest settings page.
 *
 * Contains pre-defined ElementLocator objects, representing the various UI
 * elements on the page used in tests.
 *
 */
class IngestSettings {
    saveBtn: any;
    schemeNameInput: any;
    tabs: any;
    newSchemeBtn: any;
    newRoutingRuleBtn: any;
    newDeskRoutingRuleBtn: any;
    writeTextToSchemeName: (text: any) => void;
    writeTextToRuleName: (text: any) => void;
    getTextfromRuleName: () => wdpromise.Promise<string>;
    routingRuleSettings: any;

    constructor() {
        var daysButonsBox = $('.day-filter-box');

        this.saveBtn = element(by.buttonText('Save'));

        // the main input box for setting the routing scheme's name
        this.schemeNameInput = $('[placeholder="Scheme name"]');

        // the main navigation tabs on the ingest settings page
        this.tabs = {
            routingTab: element(by.buttonText('Ingest Routing')),
        };

        this.newSchemeBtn = element(by.partialButtonText('Add New'));

        this.newRoutingRuleBtn = element(by.css('[data-test-id="add-routing-rule-button"]'));
        this.newDeskRoutingRuleBtn = element(by.css('[data-test-id="rule-handler--desk_fetch_publish"]'));

        var newSchemeInput = element(by.model('editScheme.name'));

        this.writeTextToSchemeName = function(text) {
            newSchemeInput.sendKeys(text);
        };

        var newRuleInput = element(by.model('rule.name'));

        this.writeTextToRuleName = function(text) {
            newRuleInput.sendKeys(text);
        };
        this.getTextfromRuleName = function() {
            return newRuleInput.getAttribute('value');
        };

        // the settings pane for routing rule (in a modal)
        this.routingRuleSettings = {
            ruleNameInput: $('[placeholder="Rule name"]'),

            // NOTE: several elements appear twice - under the FETCH settings
            // and under the PUBLISH settings, hence the need to locate them all
            // and select them by index, e.g. .get(0)
            showFetchBtn: $$('.icon-plus-small').get(0),
            fetchDeskList: element.all(by.name('desk')).get(0),
            fetchStageList: element.all(by.name('stage')).get(0),
            fetchMacroList: element.all(by.name('macro')).get(0),

            showPublishBtn: $$('.icon-plus-small').get(1),
            publishDeskList: element.all(by.name('desk')).get(1),
            publishStageList: element.all(by.name('stage')).get(1),
            publishMacroList: element.all(by.name('macro')).get(1),

            daysButtons: {
                mon: daysButonsBox.element(by.className('sd-checkbox--button-Monday')),
                tue: daysButonsBox.element(by.className('sd-checkbox--button-Tuesday')),
                wed: daysButonsBox.element(by.className('sd-checkbox--button-Wednesday')),
                thu: daysButonsBox.element(by.className('sd-checkbox--button-Thursday')),
                fri: daysButonsBox.element(by.className('sd-checkbox--button-Friday')),
                sat: daysButonsBox.element(by.className('sd-checkbox--button-Saturday')),
                sun: daysButonsBox.element(by.className('sd-checkbox--button-Sunday')),
            },

            allDayCheckBox: $('.sd-checkbox--button-allDay'),

            timezoneLabel: element(by.id('timezone')),
            timezoneDeleteBtn: element(by.css('[ng-click="clearSelectedTimeZone()"]')),
            timezoneInput: $('[term="tzSearchTerm"]').element(by.model('term')),
            timezoneList: $('.item-list').all(by.tagName('li')),
        };
    }
}

export function logout() {
    click(currentUserButton);
    click(signOutButton);
    browser.sleep(500);
    browser.refresh();
}

export const searchProvider = new SearchProvider();
export const ingestDashboard = new IngestDashboard();
export const ingestSettings = new IngestSettings();
export const currentUserButton = element(by.className('current-user__button'));
export const signOutButton = element(by.buttonText('Sign out'));
