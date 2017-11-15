/**
 * Created by liyanq on 9/17/17.
 */
import { Component, Injector, OnDestroy, OnInit } from "@angular/core"
import { Subscription } from "rxjs/Subscription";
import { Message } from "../../shared/message-service/message";
import { BUTTON_STYLE } from "../../shared/shared.const";
import { WebsocketService } from "../../shared/websocket-service/websocket.service";
import { ServiceStepBase } from "../service-step";
import { Response } from "@angular/http"

// const PROCESS_SERVICE_CONSOLE_URL = `ws://10.165.22.61:8088/api/v1/jenkins-job/console?job_name=process_service`;
const PROCESS_SERVICE_CONSOLE_URL = `ws://localhost/api/v1/jenkins-job/console?job_name=process_service`;
@Component({
  templateUrl: "./deploy.component.html",
  styleUrls: ["./deploy.component.css"]
})
export class DeployComponent extends ServiceStepBase implements OnInit, OnDestroy {
  isDeployed: boolean = false;
  isDeploySuccess: boolean = false;
  isInDeployIng: boolean = false;
  consoleText: string = "";
  processImageSubscription: Subscription;
  _confirmSubscription: Subscription;

  constructor(protected injector: Injector, private webSocketService: WebsocketService,) {
    super(injector);
  }

  ngOnInit() {
    this.k8sService.getServiceConfig(this.newServiceId,this.outputData).then(res => {
      this.outputData = res;
      this.outputData.projectinfo.config_phase = "deploy";
    });
    this._confirmSubscription = this.messageService.messageConfirmed$.subscribe((next: Message) => {
      this.k8sService.deleteDeployment(this.outputData.projectinfo.service_id)
        .then(() => {
          if (this.processImageSubscription) {
            this.processImageSubscription.unsubscribe();
          }
          this.k8sService.stepSource.next({index:0,isBack:false});
        })
        .catch(err => {
          this.messageService.dispatchError(err);
          if (this.processImageSubscription) {
            this.processImageSubscription.unsubscribe();
          }
          this.k8sService.stepSource.next({index:0,isBack:false});
        })
    });
  }

  ngOnDestroy() {
    this._confirmSubscription.unsubscribe();
  }

  serviceDeploy() {
    if (!this.isDeployed) {
      this.isDeployed = true;
      this.isInDeployIng = true;
      this.consoleText = "Deploying...";
      this.k8sService.serviceDeployment(this.outputData)
        .then(res => {
          setTimeout(() => {
            this.processImageSubscription = this.webSocketService
              .connect(PROCESS_SERVICE_CONSOLE_URL + `&token=${this.appInitService.token}`)
              .subscribe(obs => {
                this.consoleText = <string>obs.data;
                let consoleTextArr: Array<string> = this.consoleText.split(/[\n]/g);
                if (consoleTextArr.find(value => value.indexOf("Finished: SUCCESS") > -1)) {
                  this.isDeploySuccess = true;
                  this.isInDeployIng = false;
                  this.processImageSubscription.unsubscribe();
                }
                if (consoleTextArr.find(value => value.indexOf("Finished: FAILURE") > -1)) {
                  this.isDeploySuccess = false;
                  this.isInDeployIng = false;
                  this.processImageSubscription.unsubscribe();
                }
              }, err => err, () => {
                this.isDeploySuccess = false;
                this.isInDeployIng = false;
              });
          }, 10000);
        })
        .catch(err => {
          if (err instanceof Response && (err as Response).status == 400){
            let errMessage = new Message();
            let resBody = (err as Response).json();
            errMessage.message = resBody["message"];
            this.messageService.globalMessage(errMessage)
          } else {
            this.messageService.dispatchError(err);
          }
          this.isDeploySuccess = false;
          this.isInDeployIng = false;
        })
    }
  }

  deleteDeploy(): void {
    let m: Message = new Message();
    m.title = "SERVICE.STEP_6_CANCEL_TITLE";
    m.buttons = BUTTON_STYLE.DELETION;
    m.message = "SERVICE.STEP_6_CANCEL_MSG";
    this.messageService.announceMessage(m);
  }

  deployComplete(): void {
    this.k8sService.stepSource.next({isBack: false, index: 0});
  }

  backStep(): void {
    this.k8sService.stepSource.next({index: 4, isBack: true});
  }
}