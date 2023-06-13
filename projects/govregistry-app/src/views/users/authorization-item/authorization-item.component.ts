import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';

import { TranslateService } from '@ngx-translate/core';

import { Tools } from 'projects/tools/src/lib/tools.service';
import { CustomValidators } from 'projects/tools/src/lib/custom-forms-validators/custom-forms.module';
import { ConfigService } from 'projects/tools/src/lib/config.service';
import { OpenAPIService } from '@services/openAPI.service';
import { environment } from '@app/environments/environment';

import { AuthorizationItem } from './authorization-item';

import { concat, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';

import moment from 'moment';
import * as jsonpatch from 'fast-json-patch';
import _ from 'lodash';

@Component({
  selector: 'app-authorization-item',
  templateUrl: 'authorization-item.component.html',
  styleUrls: ['authorization-item.component.scss']
})
export class AuthorizationItemComponent implements OnInit, OnDestroy {

  @Input() uid: number | null = null;
  @Input() data: any = null;
  @Input() editable: boolean = true;
  
  @Output() close: EventEmitter<any> = new EventEmitter();
  @Output() save: EventEmitter<any> = new EventEmitter();
  @Output() delete: EventEmitter<any> = new EventEmitter();
  
  _organizations: any[] = [];
  _orgCount: number = 0;
  _services: any[] = [];
  _servCount: number = 0;
  _avatarLimit: number = 5;

  _isEdit: boolean = false;
  _isNew: boolean = false;

  _formGroup: UntypedFormGroup = new UntypedFormGroup({});

  _spin: boolean = false;

  _message: string = 'APP.MESSAGE.NoResults';
  _messageHelp: string = 'APP.MESSAGE.NoResultsHelp';

  _error: boolean = false;
  _errorMsg: string = '';
  
  _savingAuthorization: boolean = false;

  minLengthTerm = 1;

  applicationsList: any[] = [
    { label: 'GovIO', value: 'govio' },
    { label: 'GovRegistry', value: 'govregistry' },
    { label: 'GovIO Planner', value: 'govio_planner' },
  ];

  applications$!: Observable<any[]>;
  applicationsInput$ = new Subject<string>();
  applicationsLoading: boolean = false;

  rolesList: any[] = [];

  roles$!: Observable<any[]>;
  rolesInput$ = new Subject<string>();
  rolesLoading: boolean = false;

  organizations$!: Observable<any[]>;
  organizationsInput$ = new Subject<string>();
  organizationsLoading: boolean = false;

  services$!: Observable<any[]>;
  servicesInput$ = new Subject<string>();
  servicesLoading: boolean = false;
  
  _organizationLogoPlaceholder: string = './assets/images/organization-placeholder.png';
  _serviceLogoPlaceholder: string = './assets/images/service-placeholder.png';

  _roles: any[] = [
    { label: 'APP.ROLE.govhub_organizations_editor', value: 'govhub_organizations_editor' },
    { label: 'APP.ROLE.govhub_organizations_viewer', value: 'govhub_organizations_viewer' },
    { label: 'APP.ROLE.govhub_services_editor', value: 'govhub_services_editor' },
    { label: 'APP.ROLE.govhub_services_viewer', value: 'govhub_services_viewer' },
    { label: 'APP.ROLE.govhub_sysadmin', value: 'govhub_sysadmin' },
    { label: 'APP.ROLE.govhub_user', value: 'govhub_user' },
    { label: 'APP.ROLE.govhub_users_editor', value: 'govhub_users_editor' },
    { label: 'APP.ROLE.govhub_users_viewer', value: 'govhub_users_viewer' },
    { label: 'APP.ROLE.govio_sender', value: 'govio_sender' },
    { label: 'APP.ROLE.govio_service_instance_editor', value: 'govio_service_instance_editor' },
    { label: 'APP.ROLE.govio_service_instance_viewer', value: 'govio_service_instance_viewer' },
    { label: 'APP.ROLE.govio_sysadmin', value: 'govio_sysadmin' },
    { label: 'APP.ROLE.govio_viewer', value: 'govio_viewer' },
  ];

  all_organizations: boolean = false;
  all_services: boolean = false;

  config: any;

  constructor(
    private translate: TranslateService,
    private configService: ConfigService,
    public tools: Tools,
    public apiService: OpenAPIService
  ) {
    this.config = this.configService.getConfiguration();
  }

  ngOnInit() {
    this._isNew = false;
    this._isEdit = false;
    if (this.data) {
      const _arrOrg = this.data.organizations
      const _arrServ = this.data.services
      this._organizations = _arrOrg.slice(0, this._avatarLimit);
      this._services = _arrServ.slice(0, this._avatarLimit);
      this._orgCount = _arrOrg.length - this._avatarLimit;
      this._servCount = _arrServ.length - this._avatarLimit;
    } else {
      const _data: AuthorizationItem = new AuthorizationItem({ ...this.data });
      this._initForm(_data);
      this._initApplications();
      // this._initApplicationsSelect([]);
      this._initRolesSelect([]);
      this._initOrganizationsSelect([]);
      this._initServicesSelect([]);
      this._isNew = true;
      this._isEdit = true;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
  }

  ngOnDestroy() {
  }

  _hasControlError(name: string) {
    return (this.f[name].errors && this.f[name].touched);
  }

  get f(): { [key: string]: AbstractControl } {
    return this._formGroup.controls;
  }

  _initForm(data: any = null) {
    if (data) {
      let _group: any = {};
      Object.keys(data).forEach((key) => {
        let value = '';
        switch (key) {
          case 'application_id':
            value = data[key] ? data[key] : '';
            _group[key] = new UntypedFormControl(value, [ Validators.required ]);
            break;
          case 'role_id':
            value = data[key] ? data[key] : '';
            _group[key] = new UntypedFormControl({ value: value, disabled: true }, [ Validators.required ]);
            break;
          case 'organizations':
          case 'services':
            value = data[key] ? data[key] : [];
            _group[key] = new UntypedFormControl(value, [ Validators.required ]);
            break;
          default:
            value = data[key] ? data[key] : null;
            _group[key] = new UntypedFormControl(value, []);
            break;
        }
      });
      this._formGroup = new UntypedFormGroup(_group);
    }
  }

  _onEdit(event: any) {
    const _data: AuthorizationItem = new AuthorizationItem({ ...this.data });
    this._initForm(_data);
    this._initOrganizationsSelect([]);
    this._initServicesSelect([]);
    this._isNew = false;
    this._isEdit = true;
  }

  __onSave(form: any) {
    const _body: any = {
      role: form.role_id,
      organizations: form.organizations,
      services: form.services,
      expiration_date: form.expiration_date ? moment(form.expiration_date).utc().format() : null
    };
    this._spin = true;
    this.apiService.saveElement(`users/${this.uid}/authorizations`, _body).subscribe(
      (response: any) => {
        this._isEdit = false;
        this.data = response;
        this.save.emit({ item: this.data });
        this._spin = false;
      },
      (error: any) => {
        this._error = true;
        this._spin = false;
        this._errorMsg = Tools.GetErrorMsg(error);
      }
    );
  }

  __removeEmpty(obj: any) {
    const $this = this;
    return Object.keys(obj)
      .filter(function (k) {
        return ( obj[k] != null && typeof obj[k] !== "object");
      })
      .reduce(function (acc: any, k: string) {
        acc[k] = typeof obj[k] === "object" ? $this.__removeEmpty(obj[k]) : obj[k];
        return acc;
      }, {});
  }

  __onUpdate(form: any) {
    this._error = false;
    const _data = this.__removeEmpty(this.data);
    const _body = this.__removeEmpty(form);
    const _bodyPatch: any[] = jsonpatch.compare(_data, _body);
    if (_bodyPatch) {
      // this.apiService.updateElementRelated('templates', this.templateId, `authorizations?authorization_id=${form.authorizationId}`,_bodyPatch).subscribe(
      //   (response: any) => {
      //     this._isEdit = false;
      //     this.data = response;
      //     this.save.emit({ item: this.data, update: true });
      //   },
      //   (error: any) => {
      //     this._error = true;
      //     this._errorMsg = Tools.GetErrorMsg(error);
      //   }
      // );
    } else {
      console.log('No difference');
    }
  }

  _onSubmit(form: any) {
    if (this._isEdit && this._formGroup.valid) {
      if (this._isNew) {
        this.__onSave(form);
      } else {
        this.__onUpdate(form);
      }
    }
  }

  _onDelete(event: any) {
    this.delete.emit({ item: this.data });
  }

  _onCancelEdit(event: any) {
    this._isEdit = false;
    this._isNew = false;
    this.close.emit({ item: this.data });
  }

  trackByFn(item: any) {
    return item.id;
  }

  _initApplications() {
    if (environment.production) {
      const _reverse_url = this.config.AppConfig.GOVAPI.REVERSE;
      const _pageUrl: string = `${_reverse_url}/applications`;

      this.getData('applications', null, false, _pageUrl).subscribe(
        (response: any) => {
          this.applicationsList = response.items.map((item: any) => {
            return { label: item.application_name, value: item.application_id };
          });
        },
        (error: any) => {
          this.applicationsList = [];
        }
      );
    } else {
      this.applicationsList = [
        {
          "application_id": "govio",
          "application_name": "GovIO",
          "deployed_uri": "http://localhost:8083/govio"
        },
        {
          "application_id": "govio_planner",
          "application_name": "GovIO Planner",
          "deployed_uri": "http://localhost:10003"
        },
        {
          "application_id": "govregistry",
          "application_name": "GovRegistry",
          "deployed_uri": "http://localhost:10001",
          "webapp_uri": "http://localhost:8083/govregistry-app"
        }
      ].map((item: any) => {
        return { label: item.application_name, value: item.application_id };
      });;
    }
  }

  _initApplicationsSelect(defaultValue: any[] = []) {
    this.applications$ = concat(
      of(defaultValue),
      this.applicationsInput$.pipe(
        // filter(res => {
        //   return res !== null && res.length >= this.minLengthTerm
        // }),
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.applicationsLoading = true),
        switchMap((term: any) => {
          return this.getData('applications', term).pipe(
            catchError(() => of([])), // empty list on error
            tap(() => this.applicationsLoading = false)
          )
        })
      )
    );
  }

  _initRolesSelect(defaultValue: any[] = []) {
    this.roles$ = concat(
      of(defaultValue),
      this.rolesInput$.pipe(
        // filter(res => {
        //   return res !== null && res.length >= this.minLengthTerm
        // }),
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.rolesLoading = true),
        switchMap((term: any) => {
          return this.getData('roles', term).pipe(
            catchError(() => of([])), // empty list on error
            tap(() => this.rolesLoading = false)
          )
        })
      )
    );
  }

  _initOrganizationsSelect(defaultValue: any[] = []) {
    this.organizations$ = concat(
      of(defaultValue),
      this.organizationsInput$.pipe(
        // filter(res => {
        //   return res !== null && res.length >= this.minLengthTerm
        // }),
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.organizationsLoading = true),
        switchMap((term: any) => {
          return this.getData('organizations', term).pipe(
            catchError(() => of([])), // empty list on error
            tap(() => this.organizationsLoading = false)
          )
        })
      )
    );
  }

  _initServicesSelect(defaultValue: any[] = []) {
    this.services$ = concat(
      of(defaultValue),
      this.servicesInput$.pipe(
        // filter(res => {
        //   return res !== null && res.length >= this.minLengthTerm
        // }),
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.servicesLoading = true),
        switchMap((term: any) => {
          return this.getData('services', term).pipe(
            catchError(() => of([])), // empty list on error
            tap(() => this.servicesLoading = false)
          )
        })
      )
    );
  }

  getData(model: string, term: any = null, application: boolean = false, pageUrl: string = ''): Observable<any> {
    let _options: any = { params: { limit: 100 } };
    if (term) {
      if (typeof term === 'string' ) {
        _options.params =  { ..._options.params, q: term };
      }
      if (typeof term === 'object' ) {
        _options.params =  { ..._options.params, ...term };
      }
    }

    let _sortField: string = '';
    switch (model) {
      case 'applications':
        _sortField = 'id';
        _options.params =  { limit: 100 };
        break;
      case 'roles':
        _sortField = 'role_name';
        if (application) {
          _options.params =  { limit: 100, application_id: term };
        }
        break;
      case 'organizations':
        _sortField = 'legal_name';
        break;
      case 'services':
        _sortField = 'service_name';
        break;
      default:
        break;
    }

    return this.apiService.getList(model, _options, pageUrl)
      .pipe(map(resp => {
        if (resp.Error) {
          throwError(resp.Error);
        } else {
          const _items = resp.items.map((item: any) => {
            return item;
          });
          return _items.sort(Tools.SortBy([_sortField], true, false));
        }
      })
      );
  }

  _orgLogoBackground = (item: any): string => {
    let logoUrl = this._organizationLogoPlaceholder;
    if (item && item._links && item._links['logo-miniature']) {
      logoUrl = item._links['logo-miniature'].href;
    }
    return `url(${logoUrl})`;
  };

  _orgLogoUrl = (item: any): string => {
    let logoUrl = this._organizationLogoPlaceholder;
    if (item && item._links && item._links['logo-miniature']) {
      logoUrl = item._links['logo-miniature'].href;
    }
    return `${logoUrl}`;
  };

  _serviceLogoBackground = (item: any): string => {
    let logoUrl = this._serviceLogoPlaceholder;
    if (item && item._links && item._links['logo-miniature']) {
      logoUrl = item._links['logo-miniature'].href;
    }
    return `url(${logoUrl})`;
  };

  _serviceLogoUrl = (item: any): string => {
    let logoUrl = this._serviceLogoPlaceholder;
    if (item && item._links && item._links['logo-miniature']) {
      logoUrl = item._links['logo-miniature'].href;
    }
    return `${logoUrl}`;
  };

  _onChangeAllOrganizations() {
    const _value = this._formGroup.controls['all_organizations'].value;
    if (_value) {
      this._formGroup.controls['organizations'].disable();
      this._formGroup.controls['organizations'].reset([]);
      this._formGroup.controls['organizations'].clearValidators();
    } else {
      this._formGroup.controls['organizations'].enable();
      this._formGroup.controls['organizations'].setValidators([Validators.required]);
      this._formGroup.controls['organizations'].updateValueAndValidity();
    }
  }

  _onChangeAllServices() {
    const _value = this._formGroup.controls['all_services'].value;
    if (_value) {
      this._formGroup.controls['services'].disable();
      this._formGroup.controls['services'].reset([]);
      this._formGroup.controls['services'].clearValidators();
    } else {
      this._formGroup.controls['services'].enable();
      this._formGroup.controls['services'].setValidators([Validators.required]);
      this._formGroup.controls['services'].updateValueAndValidity();
    }
  }

  _onChangeApplication(event: any) {
    const application_id = this._formGroup.controls['application_id'].value;
    this._formGroup.controls['role_id'].setValue('');

    this.getData('roles', application_id, true).subscribe(
      (response: any) => {
        this.rolesList = response.map((item: any) => {
          return { label: item.role_name, value: item.id };
        });
      },
      (error: any) => {
        this.rolesList = [];
      }
    );
  }
}
