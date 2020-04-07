package service

import (
	"git/inspursoft/board/src/adminserver/encryption"
	"git/inspursoft/board/src/adminserver/models"
	"github.com/astaxie/beego/orm"
	"strings"
	"io/ioutil"
	"os"
	"path"

	"github.com/alyu/configparser"
)

//GetAllCfg returns the original data read from cfg file.
func GetAllCfg(which string) (*models.Configuration, error) {
	var cfgPath string
	configparser.Delimiter = "="
	if which == "" {
		cfgPath = path.Join("/go", "/cfgfile/board.cfg")
	} else {
		cfgPath = path.Join("/go", "/cfgfile/board.cfg.tmp")
	}
	
	//use configparser to read indicated cfg file.
	config, err := configparser.Read(cfgPath)
	if err != nil {
		return nil, err
	}
	//section sensitive, global refers to all sections.
	section, err := config.Section("global")
	if err != nil {
		return nil, err
	}

	//assigning values for each properties.
	Cfgi := models.GetConfiguration(section)

	Cfgi.Other.BoardAdminPassword = ""
	Cfgi.Other.DBPassword = ""
	Cfgi.Jenkinsserver.NodePassword = ""
	Cfgi.Email.Password = ""
	backupPath := path.Join("/go", "/cfgfile/board.cfg.bak1")
	Cfgi.FirstTimePost = !encryption.CheckFileIsExist(backupPath)
	tmpPath := path.Join("/go", "/cfgfile/board.cfg.tmp")
	Cfgi.TmpExist = encryption.CheckFileIsExist(tmpPath)
	if which == "" {
		Cfgi.Current = "cfg"
	} else {
		Cfgi.Current = "tmp"
	}

	return &Cfgi, nil
}

//UpdateCfg returns updated struct of data and set values for the cfg file.
func UpdateCfg(cfg *models.Configuration) error {
	configparser.Delimiter = "="
	cfgPath := path.Join("/go", "/cfgfile/board.cfg")
	//use configparser to read indicated cfg file.
	config, err := configparser.Read(cfgPath)
	if err != nil {
		return err
	}
	//section sensitive, global refers to all sections.
	section, err := config.Section("global")
	if err != nil {
		return err
	}

	o := orm.NewOrm()
	o.Using("default")
	account := models.Account{Id: 1}
	err = o.Read(&account)
	if err != nil {
		return nil
	}
	cfg.Other.BoardAdminPassword = account.Password

	b, err := ioutil.ReadFile(path.Join(models.DBconfigdir, "/env"))
	if err != nil {
		return nil
	}
	DBpassword := strings.TrimPrefix(string(b), "DB_PASSWORD=")
	DBpassword = strings.Replace(DBpassword, "\n", "", 1)
	cfg.Other.DBPassword = DBpassword

	if cfg.Email.Identity == ""{
		cfg.Email.Identity = " "
	}

	//setting value for each properties.
	models.UpdateConfiguration(section, cfg)

	//save the data from cache to file.
	err = configparser.Save(config, cfgPath)
	if err != nil {
		return err
	}

	err = os.Rename(cfgPath, cfgPath+".tmp")
	if err != nil {
		if !os.IsNotExist(err) { // fine if the file does not exists
			return err
		}
	}
	err = os.Rename(cfgPath+".bak", cfgPath)
	if err != nil {
		if !os.IsNotExist(err) { // fine if the file does not exists
			return err
		}
	}

	return nil
}

//GetKey generates 2 keys and return the public one.
func GetKey() string {
	_, pubKey := encryption.GenKey("rsa")
	//ciphertext := encryption.Encrypt("rsa", []byte("123456a?"), pubKey)
	//fmt.Println("###ciphertext:", base64.StdEncoding.EncodeToString(ciphertext))
	return string(pubKey)
}
