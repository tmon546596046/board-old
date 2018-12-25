import { Component, Injector, OnInit } from '@angular/core';
import { Container, EnvStruct, PHASE_CONFIG_CONTAINERS, UiServiceFactory, UIServiceStep2, VolumeStruct } from '../service-step.component';
import { BuildImageDockerfileData, Image, ImageDetail } from "../../image/image";
import { ServiceStepBase } from "../service-step";
import { CreateImageComponent } from "../../image/image-create/image-create.component";
import { EnvType } from "../../shared/environment-value/environment-value.component";
import { ValidationErrors } from "@angular/forms";
import { Observable } from "rxjs/Observable";
import { NodeAvailableResources } from "../../shared/shared.types";
import "rxjs/add/operator/map"
import { VolumeMountsComponent } from "./volume-mounts/volume-mounts.component";

@Component({
  templateUrl: './config-container.component.html',
  styleUrls: ["./config-container.component.css"]
})
export class ConfigContainerComponent extends ServiceStepBase implements OnInit {
  patternContainerName: RegExp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  patternWorkdir: RegExp = /^~?[\w\d-\/.{}$\/:]+[\s]*$/;
  patternCpuRequest: RegExp = /^[0-9]*m$/;
  patternCpuLimit: RegExp = /^[0-9]*m$/;
  patternMemRequest: RegExp = /^[0-9]*Mi$/;
  patternMemLimit: RegExp = /^[0-9]*Mi$/;
  imageSourceList: Array<Image>;
  imageDetailSourceList: Map<string, Array<ImageDetail>>;
  imageTagNotReadyList: Map<string, boolean>;
  containerIsInEdit: Map<Container, boolean>;
  fixedContainerPort: Map<string, Array<number>>;
  fixedContainerEnv: Map<string, Array<EnvStruct>>;
  serviceStep2Data: UIServiceStep2;
  showEnvironmentValue = false;
  showVolumeMounts = false;
  curEditEnvContainer: Container;

  constructor(protected injector: Injector) {
    super(injector);
    this.imageDetailSourceList = new Map<string, Array<ImageDetail>>();
    this.imageTagNotReadyList = new Map<string, boolean>();
    this.containerIsInEdit = new Map<Container, boolean>();
    this.fixedContainerPort = new Map<string, Array<number>>();
    this.fixedContainerEnv = new Map<string, Array<EnvStruct>>();
    this.serviceStep2Data = UiServiceFactory.getInstance(PHASE_CONFIG_CONTAINERS) as UIServiceStep2;
  }

  ngOnInit() {
    this.k8sService.getServiceConfig(PHASE_CONFIG_CONTAINERS).subscribe((res: UIServiceStep2) => {
      this.serviceStep2Data = res;
      this.serviceStep2Data.containerList.forEach((container: Container) => {
        this.getImageDetailList(container.image.image_name).subscribe();
        this.containerIsInEdit.set(container, false);
        this.setContainerFixedInfo(container);
      });
      if (this.serviceStep2Data.containerList.length == 0) {
        this.addEmptyWorkItem();
      }
    });
    this.k8sService.getImages("", 0, 0).subscribe(res => {
      this.imageSourceList = res;
      this.unshiftCustomerCreateImage();
    })
  }

  changeSelectImage(index: number, image: Image) {
    let container = this.serviceStep2Data.containerList[index];
    container.name = image.image_name.substr(image.image_name.indexOf('/') + 1);
    container.image.project_name = this.serviceStep2Data.projectName;
    container.image.image_name = image.image_name;
    this.toggleContainerEditStatus(container);
    if (this.imageDetailSourceList.has(image.image_name)) {
      let detailList: Array<ImageDetail> = this.imageDetailSourceList.get(image.image_name);
      container.image.image_tag = detailList[0].image_tag;
      this.setDefaultContainerInfo(container);
      this.setContainerFixedInfo(container);
    } else {
      this.getImageDetailList(image.image_name).subscribe((res: ImageDetail[]) => {
        container.image.image_tag = res[0].image_tag;
        this.setDefaultContainerInfo(container);
        this.setContainerFixedInfo(container);
      })
    }
  }

  changeSelectImageDetail(imageName: string, imageDetail: ImageDetail) {
    let container = this.serviceStep2Data.containerList.find(value => value.image.image_name == imageName);
    container.image.image_tag = imageDetail.image_tag;
    this.setDefaultContainerInfo(container);
    this.setContainerFixedInfo(container);
  }

  getImageDetailList(imageName: string): Observable<Array<ImageDetail>> {
    this.imageTagNotReadyList.set(imageName, false);
    return this.k8sService.getImageDetailList(imageName).map((res: Array<ImageDetail>) => {
      if (res && res.length > 0) {
        for (let item of res) {
          item['image_detail'] = JSON.parse(item['image_detail']);
          item['image_size_number'] = Number.parseFloat((item['image_size_number'] / (1024 * 1024)).toFixed(2));
          item['image_size_unit'] = 'MB';
        }
        this.imageDetailSourceList.set(imageName, res);
      } else {
        this.imageTagNotReadyList.set(imageName, true);
      }
      return res;
    })
  }

  setContainerFixedInfo(container: Container): void {
    const imageIndex = container.image;
    this.k8sService.getContainerDefaultInfo(imageIndex.image_name, imageIndex.image_tag, imageIndex.project_name).subscribe(
      (res: BuildImageDockerfileData) => {
        if (res.image_env) {
          let fixedEnvs: Array<EnvStruct> = Array<EnvStruct>();
          res.image_env.forEach(value => {
            let env = new EnvStruct();
            env.dockerfile_envname = value.dockerfile_envname;
            env.dockerfile_envvalue = value.dockerfile_envvalue;
            fixedEnvs.push(env);
          });
          this.fixedContainerEnv.set(imageIndex.image_name, fixedEnvs);
        }
        if (res.image_expose) {
          let fixedPorts: Array<number> = Array();
          res.image_expose.forEach(value => {
            let port: number = Number(value).valueOf();
            fixedPorts.push(port);
          });
          this.fixedContainerPort.set(imageIndex.image_name, fixedPorts);
        }
      }, () => this.messageService.cleanNotification()
    );
  }


  setDefaultContainerInfo(container: Container): void {
    const imageIndex = container.image;
    this.k8sService.getContainerDefaultInfo(imageIndex.image_name, imageIndex.image_tag, imageIndex.project_name).subscribe(
      (res: BuildImageDockerfileData) => {
        if (res.image_cmd) {
          container.command = res.image_cmd;
        }
        if (res.image_env) {
          res.image_env.forEach(value => {
            let env = new EnvStruct();
            env.dockerfile_envname = value.dockerfile_envname;
            env.dockerfile_envvalue = value.dockerfile_envvalue;
            container.env.push(env);
          });
        }
        if (res.image_expose) {
          res.image_expose.forEach(value => {
            let port: number = Number(value).valueOf();
            container.container_port.push(port);
          });
        }
      }, () => this.messageService.cleanNotification());
  }

  isValidContainerNames(): {valid: boolean, invalidIndex: number} {
    let invalidIndex: number = -1;
    let everyValid = this.serviceStep2Data.containerList.every((container, index: number) => {
      invalidIndex = index;
      return this.patternContainerName.test(container.name);
    });
    return {valid: everyValid, invalidIndex: invalidIndex};
  }

  isValidContainerPorts(): {valid: boolean, invalidIndex: number} {
    let invalidIndex: number = -1;
    let valid = true;
    let portBuf = new Set<number>();
    this.serviceStep2Data.containerList.forEach((container, index) => {
      container.container_port.forEach(port => {
        if (portBuf.has(port)) {
          invalidIndex = index;
          valid = false
        } else {
          portBuf.add(port);
        }
      })
    });
    return {valid: valid, invalidIndex: invalidIndex};
  }

  forward(): void {
    let funShowInvalidContainer = (invalidIndex: number) => {
      let iterator: IterableIterator<Container> = this.containerIsInEdit.keys();
      let key = iterator.next();
      while (!key.done) {
        this.containerIsInEdit.set(key.value, false);
        key = iterator.next();
      }
      this.containerIsInEdit.set(this.serviceStep2Data.containerList[invalidIndex], true);
      setTimeout(() => this.verifyInputValid());
    };
    let checkContainerName = this.isValidContainerNames();
    if (checkContainerName.valid) {
      let checkContainerPort = this.isValidContainerPorts();
      if (checkContainerPort.valid) {
        if (this.verifyInputValid() && this.verifyInputArrayValid()) {
          this.k8sService.setServiceConfig(this.serviceStep2Data.uiToServer()).subscribe(
            () => this.k8sService.stepSource.next({index: 3, isBack: false})
          );
        }
      } else {
        funShowInvalidContainer(checkContainerPort.invalidIndex);
        this.messageService.showAlert('SERVICE.STEP_2_CONTAINER_PORT_REPEAT', {alertType: "alert-warning"});
      }
    } else {
      funShowInvalidContainer(checkContainerName.invalidIndex)
    }
  }

  get isCanNextStep(): boolean {
    return this.serviceStep2Data.containerList
      .filter(value => value.image.image_name != "SERVICE.STEP_2_SELECT_IMAGE")
      .length == this.serviceStep2Data.containerList.length;
  }

  get selfObject() {
    return this;
  }

  get checkSetCpuRequestFun(){
    return this.checkSetCpuRequest.bind(this);
  }

  get checkSetMemRequestFun(){
    return this.checkSetMemRequest.bind(this);
  }

  unshiftCustomerCreateImage() {
    let customerCreateImage: Image = new Image();
    customerCreateImage.image_name = "SERVICE.STEP_2_CREATE_IMAGE";
    customerCreateImage["isSpecial"] = true;
    customerCreateImage["OnlyClick"] = true;
    this.imageSourceList.unshift(customerCreateImage);
  }

  canChangeSelectImage(image: Image) {
    if (this.serviceStep2Data.containerList.find(value => value.image.image_name == image.image_name)) {
      this.messageService.showAlert('IMAGE.CREATE_IMAGE_EXIST', {alertType: "alert-warning"});
      return false;
    }
    return true;
  }

  checkSetCpuRequest(control: HTMLInputElement): Observable<ValidationErrors | null> {
    return this.k8sService.getNodesAvailableSources().map((res: Array<NodeAvailableResources>) => {
      let isInValid = res.every(value => Number.parseInt(control.value) > Number.parseInt(value.cpu_available) * 1000);
      if (isInValid) {
        return {beyondMaxLimit: 'SERVICE.STEP_2_BEYOND_MAX_VALUE'};
      } else {
        return null;
      }
    })
  }

  checkSetMemRequest(control: HTMLInputElement): Observable<ValidationErrors | null> {
    return this.k8sService.getNodesAvailableSources().map((res: Array<NodeAvailableResources>) => {
      let isInValid = res.every(value => Number.parseInt(control.value) > Number.parseInt(value.mem_available) / (1024 * 1024));
      if (isInValid) {
        return {beyondMaxLimit: 'SERVICE.STEP_2_BEYOND_MAX_VALUE'};
      } else {
        return null;
      }
    })
  }

  createNewCustomImage(index: number) {
    let newImageIndex = index;
    let component = this.createNewModal(CreateImageComponent);
    component.initCustomerNewImage(this.serviceStep2Data.projectId, this.serviceStep2Data.projectName);
    component.closeNotification.subscribe((imageName: string) => {
      if (imageName) {
        this.k8sService.getImages("", 0, 0).subscribe(res => {
          res.forEach(value => {
            if (value.image_name === imageName) {
              this.imageSourceList = Object.create(res);
              this.unshiftCustomerCreateImage();
              this.changeSelectImage(newImageIndex, value);
            }
          });
        })
      }
    })
  }

  minusSelectImage(index: number) {
    if (index > 0) {
      this.serviceStep2Data.containerList.splice(index, 1);
    }
  }

  addEmptyWorkItem() {
    let container = new Container();
    container.image.image_name = 'SERVICE.STEP_2_SELECT_IMAGE';
    this.containerIsInEdit.set(container, false);
    this.serviceStep2Data.containerList.push(container);
  }

  getVolumesDescription(index: number, container: Container): string {
    let volume = container.volume_mounts;
    if (volume.length > index){
      let storageServer = volume[index].target_storage_service == "" ? "" : volume[index].target_storage_service.concat(":");
      let result = `${volume[index].container_path}:${storageServer}${volume[index].target_path}`;
      return result == ":" ? "" : result;
    } else {
      return ""
    }
  }

  getEnvsDescription(container: Container): string {
    let envsArr = container.env;
    let result: string = "";
    envsArr.forEach((value: EnvStruct) => {
      result += `${value.dockerfile_envname}=${value.dockerfile_envvalue};`
    });
    return result;
  }

  toggleContainerEditStatus(container: Container): void {
    let oldStatus = this.containerIsInEdit.get(container);
    let iterator: IterableIterator<Container> = this.containerIsInEdit.keys();
    let key = iterator.next();
    while (!key.done){
      this.containerIsInEdit.set(key.value,false);
      key = iterator.next();
    }
    this.containerIsInEdit.set(container, !oldStatus);
  }

  editEnvironment(container: Container) {
    this.curEditEnvContainer = container;
    this.showEnvironmentValue = true;
  }

  setEnvironment(envsData: Array<EnvType>) {
    let envsArray = this.curEditEnvContainer.env;
    envsArray.splice(0, envsArray.length);
    envsData.forEach((value: EnvType) => {
      let env = new EnvStruct();
      env.dockerfile_envname = value.envName;
      env.dockerfile_envvalue = value.envValue;
      envsArray.push(env);
    });
  }

  editVolumeMount(container: Container) {
    this.curEditEnvContainer = container;
    this.showVolumeMounts = true;
    let component = this.createNewModal(VolumeMountsComponent);
    component.volumeDataList = this.curEditEnvContainer.volume_mounts;
    component.onConfirmEvent.subscribe((res: Array<VolumeStruct>) => this.curEditEnvContainer.volume_mounts = res);
  }

  getDefaultEnvsData() {
    let result = Array<EnvType>();
    this.curEditEnvContainer.env.forEach((value: EnvStruct) => {
      result.push(new EnvType(value.dockerfile_envname, value.dockerfile_envvalue))
    });
    return result;
  }

  getDefaultEnvsFixedData(): Array<string> {
    let result = Array<string>();
    if (this.fixedContainerEnv.has(this.curEditEnvContainer.image.image_name)) {
      let fixedEnvs: Array<EnvStruct> = this.fixedContainerEnv.get(this.curEditEnvContainer.image.image_name);
      fixedEnvs.forEach(value => result.push(value.dockerfile_envvalue));
    }
    return result;
  }

  backStep() {
    this.k8sService.stepSource.next({index: 1, isBack: true});
  }
}