/**
 * @file Ayos: store settings, owner PIN, backup/restore, demo data and reset.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { AuthError, ValidationError } from '../../core/AppError.js';
import { el, readForm } from '../../utils/dom.js';
import { downloadTextFile, readFileAsText } from '../../utils/download.js';
import { t } from '../../utils/i18n.js';
import { confirmAction, confirmByTyping, requirePin } from '../components/dialogs.js';
import {
  buildForm,
  clearFormErrors,
  field,
  integerField,
  showFormError,
} from '../components/FormField.js';
import { icon } from '../components/icons.js';
import { button, panel } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

export class SettingsView extends BaseView {
  /** @returns {Node[]} */
  build() {
    return [
      this.pageHeader(t('settings.title'), t('settings.subtitle')),
      el('div', { className: 'layout-two' }, [
        this.buildStoreForm(),
        el('div', { className: 'layout-stack' }, [this.buildPinPanel(), this.buildDataPanel()]),
      ]),
    ];
  }

  /** @returns {HTMLElement} */
  buildStoreForm() {
    const form = buildForm({
      children: [this.buildStoreFields(this.services.settingsService.get())],
      submitButton: button({
        label: t('common.save'),
        variant: 'primary',
        type: 'submit',
        iconName: 'check',
      }),
      onSubmit: (values) =>
        this.runAction(() => this.services.settingsService.update(values), {
          form,
          successMessage: t('settings.saved'),
        }),
    });
    return panel({ title: t('settings.storeTitle'), iconName: 'store', children: [form] });
  }

  /**
   * @param {Object} settings
   * @returns {HTMLElement}
   */
  buildStoreFields(settings) {
    const languages = [
      { value: 'en', label: 'English' },
      { value: 'fil', label: 'Filipino' },
    ];
    const dayField = (name, labelKey, hint = '') =>
      integerField({ name, label: t(labelKey), value: settings[name], hint });
    return el('div', { className: 'form-grid' }, [
      field({
        name: 'storeName',
        label: t('settings.storeName'),
        value: settings.storeName,
        className: 'form-grid--full',
      }),
      field({ name: 'ownerName', label: t('settings.ownerName'), value: settings.ownerName }),
      field({
        name: 'language',
        label: t('settings.language'),
        type: 'select',
        value: settings.language,
        options: languages,
      }),
      dayField('overdueDays', 'settings.overdueDays', t('settings.overdueHint')),
      dayField('expiryWarningDays', 'settings.expiryDays'),
      dayField('slowMoverDays', 'settings.slowDays'),
    ]);
  }

  /** @returns {HTMLElement} */
  buildPinPanel() {
    const hasPin = this.services.authService.hasPin();
    const form = buildForm({
      children: [this.buildPinFields(hasPin)],
      extraActions: [
        hasPin
          ? button({
              label: t('settings.removePin'),
              variant: 'ghost',
              onClick: () => this.removePin(form),
            })
          : null,
      ],
      submitButton: button({
        label: hasPin ? t('settings.changePin') : t('settings.setPin'),
        variant: 'primary',
        type: 'submit',
        iconName: 'lock',
      }),
      onSubmit: (values) => this.savePin(form, values),
    });
    const status = el('span', {
      className: `stamp ${hasPin ? 'stamp--ok' : 'stamp--ink'}`,
      text: hasPin ? t('settings.pinOn') : t('settings.pinOff'),
    });
    const help = el('p', { className: 'text-small text-muted', text: t('settings.pinHelp') });
    return panel({
      title: t('settings.pinTitle'),
      iconName: 'lock',
      children: [help, el('p', {}, [status]), form],
    });
  }

  /**
   * @param {boolean} hasPin - Changing an existing PIN asks for the current one.
   * @returns {HTMLElement}
   */
  buildPinFields(hasPin) {
    const pinField = (name, labelKey) =>
      field({
        name,
        label: t(labelKey),
        type: 'password',
        attrs: {
          inputmode: 'numeric',
          autocomplete: name === 'currentPin' ? 'off' : 'new-password',
        },
      });
    return el('div', { className: 'form-grid' }, [
      hasPin ? pinField('currentPin', 'settings.currentPin') : null,
      pinField('pin', 'settings.newPin'),
      pinField('pinConfirm', 'settings.confirmPin'),
    ]);
  }

  /**
   * @param {HTMLFormElement} form
   * @param {Object<string, string>} values
   */
  async savePin(form, values) {
    if (values.pin !== values.pinConfirm) {
      showFormError(form, new ValidationError('errors.pinMismatch', {}, 'pinConfirm'));
      return;
    }
    const isSaved = await this.runAction(
      async () => {
        await this.services.authService.setPin(values.pin, values.currentPin);
        return true;
      },
      { form, successMessage: t('settings.pinSaved') },
    );
    // Redraw only on success: redrawing after a failure would wipe the error message.
    if (isSaved) {
      this.render();
    }
  }

  /**
   * @param {HTMLFormElement} form
   */
  async removePin(form) {
    clearFormErrors(form);
    const currentPin = readForm(form).currentPin;
    if (!currentPin) {
      showFormError(form, new AuthError('errors.wrongPin', {}, 'currentPin'));
      return;
    }
    const isRemoved = await this.runAction(
      async () => {
        await this.services.authService.removePin(currentPin);
        return true;
      },
      { form, successMessage: t('settings.pinRemoved') },
    );
    if (isRemoved) {
      this.render();
    }
  }

  /** @returns {HTMLElement} */
  buildDataPanel() {
    const fileInput = el('input', {
      className: 'visually-hidden',
      attrs: {
        type: 'file',
        accept: 'application/json,.json',
        'aria-label': t('settings.restore'),
      },
    });
    fileInput.addEventListener('change', () => this.restoreFromFile(fileInput));
    const { isPersistent } = this.context.storage;
    const storageNote = isPersistent ? t('settings.storageOk') : t('settings.storageMemory');
    return panel({
      title: t('settings.dataTitle'),
      iconName: 'box',
      modifier: 'cardboard',
      children: [
        el('p', { className: 'text-small' }, [
          icon(isPersistent ? 'check' : 'alert'),
          ` ${storageNote}`,
        ]),
        el('div', { className: 'btn-row' }, [
          button({
            label: t('settings.backup'),
            iconName: 'download',
            onClick: () => this.downloadBackup(),
          }),
          button({
            label: t('settings.restore'),
            iconName: 'upload',
            onClick: () => fileInput.click(),
          }),
          fileInput,
        ]),
        el('hr', { className: 'receipt__rule' }),
        el('p', { className: 'text-small', text: t('settings.demoHelp') }),
        this.buildDangerButtons(),
      ],
    });
  }

  /** @returns {HTMLElement} Demo data and reset buttons. */
  buildDangerButtons() {
    return el('div', { className: 'btn-row' }, [
      button({
        label: t('settings.loadDemo'),
        variant: 'yellow',
        iconName: 'sun',
        onClick: () => this.loadDemo(),
      }),
      button({
        label: t('settings.reset'),
        variant: 'primary',
        iconName: 'trash',
        onClick: () => this.resetAll(),
      }),
    ]);
  }

  /** Saves every record as a JSON file. */
  downloadBackup() {
    const backup = this.services.backupService.createBackup();
    downloadTextFile(
      `tindahan-backup-${this.context.clock.today()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json',
    );
    this.toast.show(t('settings.backupDone'), 'success');
  }

  /**
   * @param {HTMLInputElement} fileInput
   */
  async restoreFromFile(fileInput) {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (!file) {
      return;
    }
    const backup = await this.runAction(async () =>
      this.services.backupService.parseBackup(await readFileAsText(file)),
    );
    if (!backup) {
      return;
    }
    const confirmed = await confirmAction({
      title: t('settings.restore'),
      message: t('settings.restoreConfirm', { date: backup.exportedAt?.slice(0, 10) ?? '?' }),
      isDanger: true,
      confirmLabel: t('settings.restore'),
    });
    if (confirmed && (await requirePin(this.services.authService, t('settings.pinForRestore')))) {
      this.runAction(() => this.services.backupService.restore(backup), {
        successMessage: t('settings.restored'),
      });
    }
  }

  /** Replaces data with 30 days of sample activity. */
  async loadDemo() {
    const confirmed = await confirmAction({
      title: t('settings.loadDemo'),
      message: t('settings.demoConfirm'),
      confirmLabel: t('settings.loadDemo'),
    });
    if (confirmed && (await requirePin(this.services.authService, t('settings.pinForRestore')))) {
      this.runAction(() => this.services.demoDataService.loadDemoData(this.context.clock.today()), {
        successMessage: t('settings.demoLoaded'),
      });
    }
  }

  /** Deletes everything after the PIN and a typed confirmation word. */
  async resetAll() {
    if (!(await requirePin(this.services.authService, t('settings.pinForReset')))) {
      return;
    }
    const word = t('settings.resetWord');
    if (
      await confirmByTyping({
        title: t('settings.reset'),
        message: t('settings.resetConfirm'),
        word,
      })
    ) {
      this.runAction(() => this.services.backupService.resetAll(), {
        successMessage: t('settings.resetDone'),
      });
    }
  }
}
