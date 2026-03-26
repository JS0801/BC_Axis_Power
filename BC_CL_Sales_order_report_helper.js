/**
* @NApiVersion 2.x
* @NScriptType ClientScript
*/
define(['N/url', 'N/runtime', 'N/format','N/ui/dialog','N/currentRecord', 'N/https','N/ui/message','N/search'],
function (url, runtime, format,dialog,currentRecord, https,message,search) {

        var scriptId = 'customscript_bc_sales_order_report';
        var deploymentId = 'customdeploy1';


  function fieldChanged(context) {

        var suiteletUrl = url.resolveScript({
          scriptId: scriptId,
          deploymentId: deploymentId,
          params: {
            salesorder: context.currentRecord.getText({fieldId: 'custpage_sales_order'}),
            salesid: context.currentRecord.getValue({fieldId: 'custpage_sales_order'}),
            projectid: context.currentRecord.getValue({fieldId: 'custpage_project'}),
            projectStatus: context.currentRecord.getValue({fieldId: 'custpage_project_status'}),
            closed: context.currentRecord.getValue({fieldId: 'custpage_closed'}),
            contract: context.currentRecord.getValue({fieldId: 'custpage_contract'}),
            soClass: context.currentRecord.getValue({fieldId: 'custpage_class'}),
            invdate: context.currentRecord.getText({fieldId: 'custpage_inv_date'})
          }
        });
        setWindowChanged(window, false);
        window.location = suiteletUrl;      
    
  }

  function onReset() {
    var resetVal = confirm('Warning: Data entered will be lost. Are you sure to continue?');
    if(resetVal == true){

      var resolveurl = url.resolveScript({
        scriptId: scriptId,
        deploymentId: deploymentId
      });

      setWindowChanged(window, false);
      window.location = resolveurl;
    }
  }

  return {
    fieldChanged: fieldChanged,
    onReset: onReset
  };
});
