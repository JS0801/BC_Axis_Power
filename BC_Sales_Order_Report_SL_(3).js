/**
* @NApiVersion 2.x
* @NScriptType Suitelet
*/
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/runtime', 'N/file'], function(serverWidget, search, log, runtime, file) {
  
  function onRequest(context) {
    if (context.request.method === 'GET') {
      try {
        // Create Suitelet Form
        var form = serverWidget.createForm({
          title: 'Unbilled Balance Report'
        });
        
        // Add client script parameter
        var ClientID = runtime.getCurrentScript().getParameter({
          name: 'custscript_client_script'
        });
        log.debug('ClientID', ClientID)
        var salesnameparam = context.request.parameters.salesorder;
        var salesIdparam = context.request.parameters.salesid;
        var projectid = context.request.parameters.projectid;
        var projectStatus = context.request.parameters.projectStatus;
        var closed = context.request.parameters.closed || 2;
        var contract = context.request.parameters.contract;
        var soClass = context.request.parameters.soClass;
        var invdate = context.request.parameters.invdate;
        log.debug('param', context.request.parameters)
        
        var soDetails = getSOdetails(projectid, projectStatus, closed, contract, soClass);
        log.debug('soDetails', soDetails)
        
        
        var salesOrderField = form.addField({
          id: 'custpage_sales_order',
          type: serverWidget.FieldType.SELECT,
          label: 'Sales Order'
        });
        sourceList(salesOrderField,'salesorder', closed)
        
        var projectField = form.addField({
          id: 'custpage_project',
          type: serverWidget.FieldType.SELECT,
          label: 'Project'
        });
        sourceList(projectField,'Project')
        if (projectid) projectField.defaultValue = projectid;
        
        var projectStatusField = form.addField({
          id: 'custpage_project_status',
          type: serverWidget.FieldType.SELECT,
          label: 'Project Status'          
        });
        sourceList(projectStatusField,'ProjectStatus')
        if (projectStatus) projectStatusField.defaultValue = projectStatus;
        
        var closedField = form.addField({
          id: 'custpage_closed',
          type: serverWidget.FieldType.SELECT,
          label: 'Sales Order Status'
        });
        sourceList(closedField,'closed')
        if (closed) closedField.defaultValue = closed;
        
        var contractField = form.addField({
          id: 'custpage_contract',
          type: serverWidget.FieldType.SELECT,
          label: 'Contract Sales Order'
        });
        sourceList(contractField,'contract');
        if (contract) contractField.defaultValue = contract;
        
        
        var classField = form.addField({
          id: 'custpage_class',
          type: serverWidget.FieldType.SELECT,
          label: 'Class',
          source: 'classification'
        });
        //   sourceList(classField,'classes')
        if (soClass) classField.defaultValue = soClass;
        
        var invField = form.addField({
          id: 'custpage_inv_date',
          type: serverWidget.FieldType.DATE,
          label: 'Invoice End Date'
        });
        
        
        // Add Sublist to display search results
        var sublist = form.addSublist({
          id: 'custpage_revenue_sublist',
          type: serverWidget.SublistType.LIST,
          label: 'Revenue List (Sales Order)'
        });
        
        // Define columns for the sublist
        
        sublist.addField({
          id: 'project_num',
          type: serverWidget.FieldType.TEXT,
          label: 'Project Number'
        });
        
        sublist.addField({
          id: 'project',
          type: serverWidget.FieldType.TEXT,
          label: 'Project Name'
        });
        
        sublist.addField({
          id: 'so_lastdate',
          type: serverWidget.FieldType.TEXT,
          label: 'Work Start Date'
        });
        
        sublist.addField({
          id: 'so_closed',
          type: serverWidget.FieldType.TEXT,
          label: 'SO Closed'
        });
        
        sublist.addField({
          id: 'so_contract',
          type: serverWidget.FieldType.TEXT,
          label: 'Contract SO'
        });
        
        sublist.addField({
          id: 'work_order_date',
          type: serverWidget.FieldType.TEXT,
          label: 'Sales Order Date'
        });

        sublist.addField({
          id: 'work_order_lastdate',
          type: serverWidget.FieldType.TEXT,
          label: 'Last Date Worked'
        }).updateDisplayType({
         displayType: serverWidget.FieldDisplayType.NORMAL
        });

        sublist.addField({
          id: 'work_order_compdate',
          type: serverWidget.FieldType.TEXT,
          label: 'Date Work Completed'
        }).updateDisplayType({
         displayType: serverWidget.FieldDisplayType.NORMAL
        });

        sublist.addField({
          id: 'work_order_prognotes',
          type: serverWidget.FieldType.TEXTAREA,
          label: 'Progress Notes'
        }).updateDisplayType({
         displayType: serverWidget.FieldDisplayType.NORMAL
        });
        
        sublist.addField({
          id: 'invoice_date',
          type: serverWidget.FieldType.TEXT,
          label: 'Latest Billed Date'
        });

        sublist.addField({
          id: 'externalid',
          type: serverWidget.FieldType.TEXT,
          label: 'SO External ID'
        });
        
        sublist.addField({
          id: 'work_order',
          type: serverWidget.FieldType.TEXT,
          label: 'Sales Order'
        });
        
        sublist.addField({
          id: 'so_class',
          type: serverWidget.FieldType.TEXT,
          label: 'Class'
        });
        
        sublist.addField({
          id: 'sales_amount',
          type: serverWidget.FieldType.CURRENCY,
          label: 'Sales Order Amount'
        });
        
        sublist.addField({
          id: 'other_amount',
          type: serverWidget.FieldType.CURRENCY,
          label: 'Return Auth. Amount'
        });
        
        sublist.addField({
          id: 'allocation_amount',
          type: serverWidget.FieldType.CURRENCY,
          label: 'Net Total Revenue'
        });
        
        sublist.addField({
          id: 'net_amount',
          type: serverWidget.FieldType.CURRENCY,
          label: 'Billed Amount'
        });
        
        sublist.addField({
          id: 'unbilled_amount',
          type: serverWidget.FieldType.CURRENCY,
          label: 'Unbilled Revenue Amount'
        });
        var revTotal = [];
        var filters = [
          [["sourcetransaction.type","anyof","SalesOrd"],"OR",["formulatext: CASE WHEN {sourcetransaction.type} = 'Return Authorization' AND {sourcetransaction.createdfrom} LIKE 'Sales%'  THEN 1 ELSE 0 END","is","1"], "OR", ["formulatext: CASE WHEN {sourcetransaction.tranid} = 'RMA522' THEN 1 ELSE 0 END", "is", "1"] ],
          "AND", 
          ["revenueplanstatus","anyof","COMPLETED"]
        ]
        
        if (salesIdparam) {
          salesOrderField.defaultValue = salesIdparam;
          filters.push("AND");
            if(salesnameparam == '13674'){
              filters.push(["formulatext: case when  {source}  = 'Sales Order #13674' OR {sourcetransaction.tranid}  = 'RMA522' then 1 else 0 end","is","1"])
            }else{
              filters.push(["formulatext: case when  {source}  = 'Sales Order #"+ salesnameparam +"' OR {sourcetransaction.createdfrom}  = 'Sales Order #"+ salesnameparam +"' then 1 else 0 end","is","1"])
            }
          
        }
        
        // Get search results using paged search
        var revenueelementSearchObj = search.create({
          type: "revenueelement",
          filters: filters,
          columns: [
            search.createColumn({
              name: "formulatext",
              summary: "GROUP",
              formula: "CASE    WHEN {sourcetransaction.type} = 'Sales Order' THEN {source}   WHEN {sourcetransaction.createdfrom} IS NULL THEN 'Sales Order #13674'   ELSE {sourcetransaction.createdfrom} END",
              label: "Work Order",
              sort: search.Sort.ASC
            }),
            search.createColumn({
              name: "formulanumeric1",
              summary: "SUM",
              formula: "(case when {sourcetransaction.type} = 'Sales Order' then {allocationamount}  else 0 end) + (case when {sourcetransaction.type} = 'Sales Order' then 0  else {allocationamount} end)",
              label: "Other Amount"
            }),        
          ]
        });
        
        var pagedResults = revenueelementSearchObj.runPaged({ pageSize: 2500});
        
        pagedResults.pageRanges.forEach(function (pageRange) {
          var pageData = pagedResults.fetch({ index: pageRange.index });
          pageData.data.forEach(function (result) {
            var salesOrderNum = result.getValue({  name: "formulatext", summary: "GROUP"}).split("Sales Order #")[1];
            var amount = result.getValue({  name: "formulanumeric1", summary: "SUM"});
            
            var obj = {
              so: salesOrderNum,
              amt: amount
            }
            
            revTotal.push(obj);
            
          });
        });
        
        var invArray = [];
        
        var invFilters = [
          ["type","anyof","CustInvc"], 
          "AND", 
          ["createdfrom","noneof","@NONE@"], 
          "AND", 
          ["createdfrom.mainline","is","T"],
          "AND", 
          ["mainline","is","T"]
        ];
        
        if(invdate){
          invField.defaultValue = invdate;
          invFilters.push("AND");
          invFilters.push(["trandate","onorbefore",invdate]);
        }
        
        var invoiceSearchObj = search.create({
          type: "invoice",
          settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
          filters: invFilters,
          columns:
          [
            search.createColumn({
              name: "tranid",
              join: "createdFrom",
              summary: "GROUP",
              label: "Document Number",
              sort: search.Sort.ASC
            }),
            search.createColumn({
              name: "amount",
              summary: "SUM",
              label: "Amount"
            }),
            search.createColumn({
              name: "trandate",
              summary: "MAX",
              label: "Date"
            })
          ]
        });
        var pagedResults = invoiceSearchObj.runPaged({ pageSize: 2500});
        
        pagedResults.pageRanges.forEach(function (pageRange) {
          var pageData = pagedResults.fetch({ index: pageRange.index });
          pageData.data.forEach(function (result) {
            var salesOrderNum = result.getValue({  name: "tranid", join: "createdFrom", summary: "GROUP"});
            var amount = result.getValue({  name: "amount", summary: "SUM"});
            var date = result.getValue({name: "trandate", summary: "MAX"})
            
            var obj = {
              so: salesOrderNum,
              invamt: amount,
              trandate: date
            }
            
            invArray.push(obj);
            
          });
        });

        var returnAuth = [];

        var returnSearchObj = search.create({
          type: "returnauthorization",
          filters:
          [
            ["createdfrom","noneof","@NONE@"], 
            "AND", 
            ["createdfrom.mainline","is","T"],
            "AND", 
            ["mainline","is","T"]
          ],
          columns:
          [
            search.createColumn({
              name: "tranid",
              join: "createdFrom",
              summary: "GROUP",
              label: "Document Number",
              sort: search.Sort.ASC
            }),
            search.createColumn({
              name: "amount",
              summary: "SUM",
              label: "Amount"
            })
          ]
        });
        var pagedResults = returnSearchObj.runPaged({ pageSize: 2500});
        
        pagedResults.pageRanges.forEach(function (pageRange) {
          var pageData = pagedResults.fetch({ index: pageRange.index });
          pageData.data.forEach(function (result) {
            var salesOrderNum = result.getValue({  name: "tranid", join: "createdFrom", summary: "GROUP"});
            var amount = result.getValue({  name: "amount", summary: "SUM"});
            
            var obj = {
              so: salesOrderNum,
              amt: amount
            }
            
            returnAuth.push(obj);
            
          });
        });
        
        var revRec = groupByOrderID(revTotal,"so");
        log.debug('revRec', revRec)
        
        var invAmt = groupByOrderID(invArray,"so");
        log.debug('invAmt', invAmt)

        var returnAmt = groupByOrderID(returnAuth,"so");
        log.debug('returnAmt', returnAmt)
        
        var soFilters = [
          ["type","anyof","SalesOrd"],
          "AND", 
          ["cseg_bc_project","noneof","@NONE@"],
          "AND", 
          ["mainline","is","T"]
        ]
        
        if (salesIdparam) {
          soFilters.push("AND"),
          soFilters.push(["internalid","anyof",salesIdparam])
        }
        
        if (projectStatus == 1 || !projectStatus) {
          soFilters.push("AND");
          soFilters.push(["cseg_bc_project.isinactive","is","F"]);
        }else if (projectStatus == 2){
          soFilters.push("AND");
          soFilters.push(["cseg_bc_project.isinactive","is","T"]);
        }
        
        if (projectid) {
          soFilters.push("AND");
          soFilters.push(["cseg_bc_project","anyof", projectid]);
        }
        if (closed == 1) {
          soFilters.push("AND");
          soFilters.push(["status","anyof","SalesOrd:G","SalesOrd:H","SalesOrd:C"]);
        }else if (closed == 2){
          soFilters.push("AND");
          soFilters.push(["status","noneof","SalesOrd:G","SalesOrd:H","SalesOrd:C"]);
        }
        if (contract == 1) {
          soFilters.push("AND");
          soFilters.push(["custbody_bc_is_bluecollar_contract","is","T"]);
        }else if (contract == 2) {
          soFilters.push("AND");
          soFilters.push(["custbody_bc_is_bluecollar_contract","is","F"]);
        }
        if (soClass) {
          soFilters.push("AND");
          soFilters.push(["class","anyof",soClass]);  
        }
        
        var salesorderSearchObj = search.create({
          type: "salesorder",
          settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
          filters:soFilters,
          columns:
          [
            search.createColumn({
              name: "internalid",
              summary: "GROUP",
              label: "Internal ID",
              sort: search.Sort.ASC
            }),
            search.createColumn({
              name: "externalid",
              summary: "GROUP",
              label: "External ID"
            }),
            search.createColumn({
              name: "tranid",
              summary: "GROUP",
              label: "Document Number"
            }),
            search.createColumn({
              name: "cseg_bc_project",
              summary: "GROUP",
              label: "Blue Collar Project"
            }),
            search.createColumn({
              name: "custbody12",
              summary: "MAX",
              label: "custbody12"
            }),
            search.createColumn({
              name: "trandate",
              summary: "MAX",
              label: "Date"
            }),
            search.createColumn({
              name: "custbody_last_date_worked",
              summary: "MAX"
            }),
            search.createColumn({
              name: "custbody_date_work_completed",
              summary: "MAX"
            }),
            search.createColumn({
              name: "custbody_progress_notes",
              summary: "GROUP"
            }),
            search.createColumn({
              name: "closed",
              summary: "GROUP",
              label: "Closed"
            }),
            search.createColumn({
              name: "custbody_bc_is_bluecollar_contract",
              summary: "GROUP",
              label: "BlueCollar Contract"
            }),
            search.createColumn({
              name: "statusref",
              summary: "GROUP",
              label: "Status"
            }),
            search.createColumn({
              name: "formulatext",
              summary: "MAX",
              formula: "{classnohierarchy}",
              label: "Class"
            }),
            search.createColumn({
              name: "custrecord_bc_proj_number",
              join: "cseg_bc_project",
              summary: "GROUP",
              label: "Project Number"
            }),
            search.createColumn({
              name: "formulanumeric",
              summary: "SUM",
              formula: "{amount}",
              label: "SO Amount"
            })
          ]
        });
    var searchResultCount = salesorderSearchObj.runPaged().count;
    log.debug("salesorderSearchObj result count",searchResultCount);
        
        var mainResults = [];
        var pageIndex = 0; // Set to desired page number if required
        var line = 0;
        var soAmt = 0;
        var ruAmt = 0;
        var totalRev = 0;
        var billedAmt = 0;
        var unbilledAmt = 0;
        
        var pagedResults = salesorderSearchObj.runPaged({ pageSize: 100});
        log.audit('pagedResults', pagedResults)
        log.audit('pagedResults', pagedResults.pageRanges)
        
        pagedResults.pageRanges.forEach(function (pageRange) {
          var pageData = pagedResults.fetch({ index: pageRange.index });
          pageData.data.forEach(function (result) {
            mainResults.push(result);
            
            var totalRevAmount = 0;
            var totalinvoiceAmt = 0;
            var totalreturnAmt = 0;
            var billedDate = '';
            
            log.debug('result', result.getValue({ name: 'tranid', summary: 'GROUP' }))

            if (result.getValue({ name: 'tranid', summary: 'GROUP' }) == '51726') 
                log.audit('invoice Amount', invAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })])
            
            if (revRec && revRec[result.getValue({ name: 'tranid', summary: 'GROUP' })] && revRec[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].amt) 
              totalRevAmount = parseFloat(revRec[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].amt);
                        
            if (invAmt && invAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })] && invAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].invamt) {
              totalinvoiceAmt = parseFloat(invAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].invamt);
              billedDate = invAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].trandate
            }
            if (returnAmt && returnAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })] && returnAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].amt) 
              totalreturnAmt = parseFloat(returnAmt[result.getValue({ name: 'tranid', summary: 'GROUP' })][0].amt);
           
            
            soAmt += parseFloat(result.getValue({ name: 'formulanumeric', summary: 'SUM' }));
            ruAmt += parseFloat(totalreturnAmt);
            totalRev += parseFloat(totalRevAmount);
            billedAmt += parseFloat(totalinvoiceAmt);
            unbilledAmt += parseFloat(totalRevAmount) - parseFloat(totalinvoiceAmt);            
            
            if (result.getValue({ name: 'custrecord_bc_proj_number', join: "cseg_bc_project", summary: 'GROUP' })) {
              sublist.setSublistValue({
                id: 'project_num',
                line: line,
                value: result.getValue({ name: 'custrecord_bc_proj_number', join: "cseg_bc_project", summary: 'GROUP' }) || ''
              });
            }
            
            sublist.setSublistValue({
              id: 'project',
              line: line,
              value:result.getText({ name: 'cseg_bc_project', summary: 'GROUP' }) || ''
            });
            if (result.getValue({ name: 'custbody12', summary: 'MAX' })) {
              sublist.setSublistValue({
                id: 'so_lastdate',
                line: line,
                value: result.getValue({ name: 'custbody12', summary: 'MAX' }) || ''
              });
            }

            if (result.getValue({ name: 'statusref', summary: 'GROUP' }) == "SalesOrd:H") {
              var closeV = 'Yes';
            }else{
              var closeV = 'No';
            }
            
            sublist.setSublistValue({
              id: 'so_closed',
              line: line,
              value: closeV
            });
            
            if (result.getValue({ name: 'custbody_bc_is_bluecollar_contract', summary: 'GROUP' })) {
              var contractV = 'Yes';
            }else{
              var contractV = 'No';
            }
            
            sublist.setSublistValue({
              id: 'so_contract',
              line: line,
              value: contractV
            });

            
            sublist.setSublistValue({
              id: 'work_order_date',
              line: line,
              value: result.getValue({ name: 'trandate', summary: 'MAX' })
            });
            
            if (result.getValue({ name: 'custbody_last_date_worked', summary: 'MAX' }))
            sublist.setSublistValue({
              id: 'work_order_lastdate',
              line: line,
              value: result.getValue({ name: 'custbody_last_date_worked', summary: 'MAX' })
            });
            
            if (result.getValue({ name: 'custbody_date_work_completed', summary: 'MAX' }))
            sublist.setSublistValue({
              id: 'work_order_compdate',
              line: line,
              value: result.getValue({ name: 'custbody_date_work_completed', summary: 'MAX' })
            });
            
            if (result.getValue({ name: 'custbody_progress_notes', summary: 'GROUP' }) && result.getValue({ name: 'custbody_progress_notes', summary: 'GROUP' }) != '- None -')
            sublist.setSublistValue({
              id: 'work_order_prognotes',
              line: line,
              value: result.getValue({ name: 'custbody_progress_notes', summary: 'GROUP' })
            });

            if (billedDate)
            sublist.setSublistValue({
              id: 'invoice_date',
              line: line,
              value: billedDate
            });
            
            sublist.setSublistValue({
              id: 'work_order',
              line: line,
              value: result.getValue({ name: 'tranid', summary: 'GROUP' })
            });

            sublist.setSublistValue({
              id: 'externalid',
              line: line,
              value: result.getValue({ name: 'externalid', summary: 'GROUP' })
            });
            
            if (result.getValue({ name: 'formulatext', summary: 'MAX' }))
            sublist.setSublistValue({
              id: 'so_class',
              line: line,
              value: result.getValue({ name: 'formulatext', summary: 'MAX' })
            });
            
            sublist.setSublistValue({
              id: 'sales_amount',
              line: line,
              value: result.getValue({ name: 'formulanumeric', summary: 'SUM' }) || ''
            });
            

            sublist.setSublistValue({
              id: 'other_amount',
              line: line,
              value: totalreturnAmt || 0
            });

            sublist.setSublistValue({
              id: 'allocation_amount',
              line: line,
              value: totalRevAmount
            });
            
            sublist.setSublistValue({
              id: 'net_amount',
              line: line,
              value: totalinvoiceAmt
            });
            
            var unbilledamount = parseFloat(totalRevAmount) - parseFloat(totalinvoiceAmt);            
            sublist.setSublistValue({
              id: 'unbilled_amount',
              line: line,
              value: unbilledamount
            });
            
            line ++;
            
            
            if (line != 0) {
              sublist.setSublistValue({
                id: 'project',
                line: line,
                value: "Total"
              });
              
              sublist.setSublistValue({
                id: 'sales_amount',
                line: line,
                value: soAmt
              });
              
              sublist.setSublistValue({
                id: 'other_amount',
                line: line,
                value: ruAmt
              });
              
              sublist.setSublistValue({
                id: 'allocation_amount',
                line: line,
                value: totalRev
              });
              
              sublist.setSublistValue({
                id: 'net_amount',
                line: line,
                value: billedAmt
              });
              
              
              sublist.setSublistValue({
                id: 'unbilled_amount',
                line: line,
                value: unbilledAmt
              });
            }
            
          });
        });
        form.addButton({
          id: 'reset',
          label: 'Reset',
          functionName: 'onReset'
        });
        
        form.clientScriptFileId = ClientID;
        
        
        form.addSubmitButton({ label: 'Export CSV' });
        context.response.writePage(form);
      } catch (e) {
        log.error({ title: 'Error Loading Search Results', details: e });
        context.response.write('Error: ' + e.message);
      }
    }
    else if (context.request.method === 'POST') {
      try{
        // Log the incoming request parameters
        log.debug('Request Parameters', context.request.parameters);
        
        // Get the total number of lines in the sublist
        var sublistId = 'custpage_revenue_sublist';
        var lineCount = context.request.getLineCount({ group: sublistId });
        
        log.debug('Line Count', lineCount);
        
        // Initialize an array to hold the sublist data
        var sublistData = [];
        
        // Loop through the sublist lines to extract values
        for (var i = 0; i < lineCount; i++) {
          var project = context.request.getSublistValue({
            group: sublistId,
            name: 'project',
            line: i
          });
          
          var project_status = context.request.getSublistValue({
            group: sublistId,
            name: 'so_lastdate',
            line: i
          });
          
          var so_closed = context.request.getSublistValue({
            group: sublistId,
            name: 'so_closed',
            line: i
          });
          
          var so_contract = context.request.getSublistValue({
            group: sublistId,
            name: 'so_contract',
            line: i
          });

          var work_order_date = context.request.getSublistValue({
            group: sublistId,
            name: 'work_order_date',
            line: i
          });

          var work_order_lastdate = context.request.getSublistValue({
            group: sublistId,
            name: 'work_order_lastdate',
            line: i
          });

          var work_order_compdate = context.request.getSublistValue({
            group: sublistId,
            name: 'work_order_compdate',
            line: i
          });

          var work_order_proggnote = context.request.getSublistValue({
            group: sublistId,
            name: 'work_order_prognotes',
            line: i
          });

           var billed_date = context.request.getSublistValue({
            group: sublistId,
            name: 'invoice_date',
            line: i
          });

          var externalid = context.request.getSublistValue({
            group: sublistId,
            name: 'externalid',
            line: i
          });

          
          var work_order = context.request.getSublistValue({
            group: sublistId,
            name: 'work_order',
            line: i
          });
          
          var so_class = context.request.getSublistValue({
            group: sublistId,
            name: 'so_class',
            line: i
          });
          
          var salesAmount = context.request.getSublistValue({
            group: sublistId,
            name: 'sales_amount',
            line: i
          });
          
          var otherAmount = context.request.getSublistValue({
            group: sublistId,
            name: 'other_amount',
            line: i
          });
          
          var allocationAmount = context.request.getSublistValue({
            group: sublistId,
            name: 'allocation_amount',
            line: i
          });
          
          var netAmount = context.request.getSublistValue({
            group: sublistId,
            name: 'net_amount',
            line: i
          });
          
          var unbilledAmount = context.request.getSublistValue({
            group: sublistId,
            name: 'unbilled_amount',
            line: i
          });
          
          var project_num = context.request.getSublistValue({
            group: sublistId,
            name: 'project_num',
            line: i
          });
          
          // Add the extracted data to the array
          sublistData.push({
            project_num: project_num,
            project: project,
            project_status: project_status,
            so_closed: so_closed,
            so_contract: so_contract,
            work_order_date: work_order_date,
            work_order_lastdate: work_order_lastdate,
            work_order_compdate: work_order_compdate,
            work_order_proggnote: work_order_proggnote,
            billed_date: billed_date,
            work_order: work_order,
            so_class: so_class,
            salesAmount: salesAmount,
            otherAmount: otherAmount,
            allocationAmount: allocationAmount,
            netAmount: netAmount,
            unbilledAmount: unbilledAmount,
            externalid: externalid
          });
        }
        
        // Log the extracted sublist data for debugging
        log.debug('Sublist Data', sublistData);

        var totalRow = null;

if (sublistData.length && sublistData[sublistData.length - 1].project === 'Total') {
  totalRow = sublistData.pop();
}

sublistData.sort(function(a, b) {
  var classA = (a.so_class || '').toLowerCase();
  var classB = (b.so_class || '').toLowerCase();

  if (classA < classB) return -1;
  if (classA > classB) return 1;

  var projectA = (a.project_num || '').toLowerCase();
  var projectB = (b.project_num || '').toLowerCase();

  if (projectA < projectB) return -1;
  if (projectA > projectB) return 1;

  var soA = parseInt(a.work_order, 10) || 0;
  var soB = parseInt(b.work_order, 10) || 0;

  return soA - soB;
});

if (totalRow) {
  sublistData.push(totalRow);
}
        
        
        var csvContent = 'Project Number,Project Name,Work Start Date,SO Closed,Contact SO,Sales Order Date,Last Date Worked,Date Work Completed,Progress Notes,Latest Billed Date,SO External ID,Sales Order,Class,Sales Order Amount,Return Auth. Amount,Net Total Revenue,Billed Amount,Unbilled Revenue Amount\n';
        sublistData.forEach(function(row) {
          csvContent += [
            row.project_num,
            row.project,
            row.project_status,
            row.so_closed,
            row.so_contract,
            row.work_order_date,
            row.work_order_lastdate,
            row.work_order_compdate,
            row.work_order_proggnote,
            row.billed_date,
            row.externalid,
            row.work_order,
            row.so_class,
            row.salesAmount,
            row.otherAmount,
            row.allocationAmount,
            row.netAmount,
            row.unbilledAmount
          ].join(',') + '\n';
        });
        
        // Log the CSV content for debugging
        log.debug('CSV Content', csvContent);
        
        // Create the file in the File Cabinet
        var fileObj = file.create({
          name: 'Project_Sales_Order_Report.csv',
          fileType: file.Type.CSV,
          contents: csvContent,
          folder: 2049 // Replace with the internal ID of the target folder
        });
        
        // Save the file to the File Cabinet
        var fileId = fileObj.save();
        var fileObj1 = file.load({id: fileId})
        
        // Log the file ID for reference
        log.debug('File ID', fileId);
        
        // Perform further processing or handle the submitted data
        // For example, you can save it to a custom record or log it.
        
        context.response.writeFile(fileObj1,false);
      } catch (e) {
        log.error({ title: 'Error Processing Form Submission', details: e });
        context.response.write('Error: ' + e.message);
      }
    }
  }
  
  
  function sourceList(salesOrderField,type, closed) {
    if (type == 'salesorder') {
      
      salesOrderField.addSelectOption({
        value: '',
        text: ''
      });
      
      var soFilters = [
        ["type","anyof","SalesOrd"], 
        "AND", 
        ["mainline","is","T"], 
        "AND", 
        ["cseg_bc_project","noneof","@NONE@"]
      ]
      
      
      if (closed == 1) {
        soFilters.push("AND");
        soFilters.push(["status","anyof","SalesOrd:G","SalesOrd:H","SalesOrd:C"]);
      }else if (closed == 2){
        soFilters.push("AND");
        soFilters.push(["status","noneof","SalesOrd:G","SalesOrd:H","SalesOrd:C"]);
      }
      
      var salesorderSearchObj = search.create({
        type: "salesorder",
        filters: soFilters,
        columns:
        [
          search.createColumn({
            name: "formulatext",
            formula: "{tranid}",
            label: "Formula (Text)"
          }),
          search.createColumn({name: "internalid", label: "Internal Id" }),
        ]
      });
      var searchResultCount = salesorderSearchObj.runPaged().count;
      log.debug("salesorderSearchObj result count",searchResultCount);
      
      var pagedResults = salesorderSearchObj.runPaged({ pageSize: 2500});
      
      pagedResults.pageRanges.forEach(function (pageRange) {
        var pageData = pagedResults.fetch({ index: pageRange.index });
        pageData.data.forEach(function (result) {
          
          salesOrderField.addSelectOption({
            value: result.getValue({ name: "internalid" }),
            text: result.getValue({ name: "formulatext", formula: "{tranid}" })
          });
          return true;
        });
      });
    }
    if (type == "closed") {
      salesOrderField.addSelectOption({
        value: 2,
        text: 'Open'
      });
      salesOrderField.addSelectOption({
        value: 1,
        text: 'Closed'
      });
      salesOrderField.addSelectOption({
        value: 3,
        text: 'Open / Closed'
      });
    }
    if (type == "contract") {
      salesOrderField.addSelectOption({
        value: '',
        text: ''
      });
      salesOrderField.addSelectOption({
        value: 1,
        text: 'Yes'
      });
      salesOrderField.addSelectOption({
        value: 2,
        text: 'No'
      });
    }
    if (type == "classes") {
      
      salesOrderField.addSelectOption({
        value: '',
        text: ''
      });
      
      var classificationSearchObj = search.create({
        type: "classification",
        filters:
        [
          ["internalid","anyof","8","1","7"]
        ],
        columns:
        [
          search.createColumn({name: "internalid", label: "Internal ID"}),
          search.createColumn({name: "name", label: "Name"})
        ]
      });
      var searchResultCount = classificationSearchObj.runPaged().count;
      log.debug("classificationSearchObj result count",searchResultCount);
      classificationSearchObj.run().each(function(result){
        
        salesOrderField.addSelectOption({
          value: result.getValue({name: "internalid"}),
          text: result.getValue({name: "name"})
        });
        
        return true;
      });
    }
    if (type == 'Project') {
      
      salesOrderField.addSelectOption({
        value: '',
        text: ''
      });
      
      var customrecord_cseg_bc_projectSearchObj = search.create({
        type: "customrecord_cseg_bc_project",
        filters:
        [
        ],
        columns:
        [
          search.createColumn({name: "internalid", label: "Internal ID"}),
          search.createColumn({name: "name", label: "Name"})
        ]
      });
      var pagedResults = customrecord_cseg_bc_projectSearchObj.runPaged({ pageSize: 2500});
      
      pagedResults.pageRanges.forEach(function (pageRange) {
        var pageData = pagedResults.fetch({ index: pageRange.index });
        pageData.data.forEach(function (result) {
          
          salesOrderField.addSelectOption({
            value: result.getValue({name: "internalid"}),
            text: result.getValue({name: "name"})
          });
          
          return true;
        });
      });
    }
    if (type == "ProjectStatus") {
      salesOrderField.addSelectOption({
        value: 1,
        text: 'Active'
      });
      salesOrderField.addSelectOption({
        value: 2,
        text: 'Inactive'
      });
    }
  }
  
  function getSOdetails(projectid, projectStatus, closed, contract, soClass){
    
    var resultArr = [];
    
    var soFilters = [
      ["type","anyof","SalesOrd"], 
      "AND", 
      ["mainline","is","T"], 
      "AND", 
      ["cseg_bc_project","noneof","@NONE@"]
    ]
    
    if (projectStatus == 1 || !projectStatus) {
      soFilters.push("AND");
      soFilters.push(["cseg_bc_project.isinactive","is","F"]);
    }else if (projectStatus == 2){
      soFilters.push("AND");
      soFilters.push(["cseg_bc_project.isinactive","is","T"]);
    }
    
    if (projectid) {
      soFilters.push("AND");
      soFilters.push(["cseg_bc_project","anyof", projectid]);    
      
    }
    if (contract == 1) {
      soFilters.push("AND");
      soFilters.push(["custbody_bc_is_bluecollar_contract","is","T"]);  
    }else if (contract == 2) {
      soFilters.push("AND");
      soFilters.push(["custbody_bc_is_bluecollar_contract","is","F"]);  
    }
    if (soClass) {
      soFilters.push("AND");
      soFilters.push(["class","anyof",soClass]);  
    }
    
    var salesorderSearchObj = search.create({
      type: "salesorder",
      settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
      filters: soFilters,
      columns:
      [
        search.createColumn({
          name: "formulatext",
          formula: "{tranid}",
          label: "Formula (Text)"
        }),
        search.createColumn({name: "name", join: "cseg_bc_project", label: "Name"}),
        search.createColumn({name: "custbody12", label: "Work Date" }),
        search.createColumn({name: "trandate", label: "SO Date" }),
        search.createColumn({name: "closed", label: "Closed"}),
        search.createColumn({name: "custbody_bc_is_bluecollar_contract", label: "BlueCollar Contract"}),
        search.createColumn({name: "classnohierarchy", label: "Class (no hierarchy)"}),
        search.createColumn({name: "custrecord_bc_proj_number", join: 'cseg_bc_project', label: "Project Number"})
      ]
    });
    var searchResultCount = salesorderSearchObj.runPaged().count;
    log.debug("salesorderSearchObj result count",searchResultCount);
    
    var pagedResults = salesorderSearchObj.runPaged({ pageSize: 3500});
    
    pagedResults.pageRanges.forEach(function (pageRange) {
      var pageData = pagedResults.fetch({ index: pageRange.index });
      pageData.data.forEach(function (result) {
        
        
        
        if (result.getValue({ name: "custbody_bc_is_bluecollar_contract" })) var contract = "Yes";
        else var contract = "No"
        
        if (result.getValue({ name: "closed" })) var closed = "Yes";
        else var closed = "No"
        
        resultArr.push({
          so: result.getValue({ name: "formulatext", formula: "{tranid}" }),
          project: result.getValue({ name: "name", join: "cseg_bc_project" }),
          status: result.getValue({ name: "custbody12" }),
          trandate: result.getValue({ name: "trandate" }),
          closed: closed,
          contract: contract,
          classid: result.getText({ name: "classnohierarchy" }) || '',
          project_num: result.getValue({ name: "custrecord_bc_proj_number", join: 'cseg_bc_project' }) || ''
        });      
        
        return true;
      });
    });
    
    return groupByOrderID(resultArr,"so");
  }
  
  function groupByOrderID(list, key){
    return list.reduce(function(rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }
  
  return {
    onRequest: onRequest
  };
});