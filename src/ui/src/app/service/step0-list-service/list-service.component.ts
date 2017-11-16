import { Component, OnInit, OnDestroy, ViewChild, Injector } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Service } from '../service';
import { MESSAGE_TARGET, BUTTON_STYLE, MESSAGE_TYPE } from '../../shared/shared.const';
import { Message } from '../../shared/message-service/message';
import { ServiceDetailComponent } from './service-detail/service-detail.component';
import { ServiceStepBase } from "../service-step";

class ServiceData {
  id: number;
  name: string;
  status: boolean;

  constructor(id: number, name: string, status: boolean) {
    this.id = id;
    this.name = name;
    this.status = status;
  }
}

@Component({
  templateUrl: './list-service.component.html',
  styleUrls:["./list-service.component.css"]
})
export class ListServiceComponent extends ServiceStepBase implements OnInit, OnDestroy {
  currentUser: {[key: string]: any};
  services: Service[];
  isInLoading: boolean = false;
  _subscription: Subscription;

  @ViewChild(ServiceDetailComponent) serviceDetailComponent;

  constructor(protected injector: Injector) {
    super(injector);
    this._subscription = this.messageService.messageConfirmed$.subscribe(m => {
      let confirmationMessage = <Message>m;
      if (confirmationMessage) {
        let serviceData = <ServiceData>confirmationMessage.data;
        let m: Message = new Message();
        switch (confirmationMessage.target) {
          case MESSAGE_TARGET.DELETE_SERVICE:
            this.k8sService
              .deleteService(serviceData.id)
              .then(() => {
                m.message = 'SERVICE.SUCCESSFUL_DELETE';
                this.messageService.inlineAlertMessage(m);
                this.retrieve();
              })
              .catch(err => {
                m.message = 'SERVICE.FAILED_TO_DELETE_SERVICE';
                m.type = MESSAGE_TYPE.COMMON_ERROR;
                this.messageService.inlineAlertMessage(m);
              });
            break;
          case MESSAGE_TARGET.TOGGLE_SERVICE: {
            let service: ServiceData = confirmationMessage.data;
            this.k8sService
              .toggleServiceStatus(service.id, service.status ? 0 : 1)
              .then(() => {
                m.message = 'SERVICE.SUCCESSFUL_TOGGLE';
                this.messageService.inlineAlertMessage(m);
                this.retrieve();
              })
              .catch(err => {
                m.message = 'SERVICE.FAILED_TO_TOGGLE';
                m.type = MESSAGE_TYPE.COMMON_ERROR;
                this.messageService.inlineAlertMessage(m);
              });
            break;
          }
        }
      }
    });
  }

  ngOnInit(): void {
    this.currentUser = this.appInitService.currentUser;
    this.retrieve();
  }

  ngOnDestroy(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
    }
  }

  get createActionIsDisabled(): boolean {
    if (this.currentUser &&
      this.currentUser.hasOwnProperty("user_project_admin") &&
      this.currentUser.hasOwnProperty("user_system_admin")) {
      return this.currentUser["user_project_admin"] == 0 && this.currentUser["user_system_admin"] == 0;
    }
    return true;
  }

  createService(): void {
    this.k8sService.stepSource.next({index: 1, isBack: false});
  }

  retrieve(): void {
    this.isInLoading = true;
    this.k8sService.getServices()
      .then(services => {
        this.services = services;
        this.isInLoading = false;
      })
      .catch(err => {
        this.messageService.dispatchError(err);
        this.isInLoading = false;
      });
  }

  getServiceStatus(status: number): string {
    //0: preparing 1: running 2: suspending
    switch (status) {
      case 0:
        return 'SERVICE.STATUS_PREPARING';
      case 1:
        return 'SERVICE.STATUS_RUNNING';
      case 2:
        return 'SERVICE.STATUS_STOPPED';
    }
  }

  toggleServicePublic(s: Service): void {
    let toggleMessage = new Message();
    this.k8sService
      .toggleServicePublicity(s.service_id, s.service_public ? 0 : 1)
      .then(() => {
        toggleMessage.message = 'SERVICE.SUCCESSFUL_TOGGLE';
        this.messageService.inlineAlertMessage(toggleMessage);
      })
      .catch(err => this.messageService.dispatchError(err, ''));
  }

  editService(s: Service) {

  }

  confirmToServiceAction(s: Service, action: string): void {
    if (s.service_status == 2){
      let serviceData = new ServiceData(s.service_id, s.service_name, false);
      let title: string;
      let message: string;
      let target: MESSAGE_TARGET;
      let buttonStyle: BUTTON_STYLE;
      switch (action) {
        case 'DELETE':
          title = 'SERVICE.DELETE_SERVICE';
          message = 'SERVICE.CONFIRM_TO_DELETE_SERVICE';
          target = MESSAGE_TARGET.DELETE_SERVICE;
          buttonStyle = BUTTON_STYLE.DELETION;
          break;
        case 'TOGGLE':
          title = 'SERVICE.TOGGLE_SERVICE';
          message = 'SERVICE.CONFIRM_TO_TOGGLE_SERVICE';
          target = MESSAGE_TARGET.TOGGLE_SERVICE;
          buttonStyle = BUTTON_STYLE.CONFIRMATION;
          break;
      }
      let announceMessage = new Message();
      announceMessage.title = title;
      announceMessage.message = message;
      announceMessage.params = [s.service_name];
      announceMessage.target = target;
      announceMessage.buttons = buttonStyle;
      announceMessage.data = serviceData;
      this.messageService.announceMessage(announceMessage);
    }
  }

  confirmToDeleteService(s: Service) {

  }

  openServiceDetail(serviceName: string, projectName: string, ownerName: string) {
    this.serviceDetailComponent.openModal(serviceName, projectName, ownerName);
  }

}
