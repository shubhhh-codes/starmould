<?php

namespace App\Http\Controllers;

use App\Models\CustomerModel;
use App\Models\GramModel;
use App\Models\PrintingModel;
use App\Models\ScanningModel;
use App\Models\UserModel;
use App\Models\WorkModel;
use App\Models\SubplateModel;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\DataTables as DataTables;

class ScanningController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //dd(Auth::user()->id);
        //
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $newDateTime = Carbon::now()->addDay(2)->format('d/m/Y');
        $currentDateTime1 = Carbon::now()->format('d/m/Y');
        $newDateTime1 = Carbon::now()->addDay(2)->format('d/m/Y');
        $data = CustomerModel::latest()->where('usertype','Customer')->get();
        $samplecount = ScanningModel::where('status','pending')->where('worktype','Sample')->count();
        $scantotal = ScanningModel::where('status','pending')->count();
        $samplecount = ScanningModel::where('status','pending')->where('worktype','Sample')->count();
        // $printtotal = PrintingModel::where('status','pending')->count();
        //create initials array from $data as $customerinitials array
        if(Auth::user()->role == 0){
            $userdata = UserModel::select('id','initials','status')->where('status','1')->get();
        }
        else{
            $userdata = UserModel::select('id','initials','status')->where('status','1')->where('id',Auth::user()->id)->get();
        }
        
        // Create an associative array to store the unique customer initials
        $customerinitials = array();
        
        // Loop through each user data
        foreach ($userdata as $d) {
            $initials = $d->initials;
            // Check if initials already exist in the uniqueCustomerInitials array
            if (array_search($initials, $customerinitials) !== false) {
                // If duplicate initials are found, append the user ID to the initials
                $initials = $initials . $d->id;
            }
            // Store the (modified) initials in the uniqueCustomerInitials array
            $customerinitials[$d->id] = $initials;
        }
        $designby = SubplateModel::select('design_by')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('design_by','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $orderby = SubplateModel::select('order_by')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('order_by','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $receivedworkby = SubplateModel::select('received_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('received_workby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $receivedqcby = SubplateModel::select('received_qcby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('received_qcby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $vmcworkby = SubplateModel::select('vmc_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('vmc_workby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $vmcqcby = SubplateModel::select('vmc_qcby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('vmc_qcby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $drilltapworkby = SubplateModel::select('drilltap_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('drilltap_workby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $finalqcby = SubplateModel::select('final_qcby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('final_qcby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $packingworkby = SubplateModel::select('packing_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('packing_workby','=', NULL)
        ->where('s.status', 'pending')->get()
        ->count();
        $orderbytotal = $orderby - $designby;
        $receivedqcbytotal = $receivedqcby - $orderbytotal ;

        return view('scanning.index', compact('currentDateTime1', 'newDateTime1', 'currentDateTime', 'newDateTime', 'data', 'scantotal','samplecount', 'designby','orderby','receivedworkby','receivedqcby','receivedqcby','vmcworkby','vmcqcby','drilltapworkby','finalqcby','packingworkby', 'customerinitials','userdata','orderbytotal','receivedqcbytotal'));
    }
    public function dashboarddata()
    {
        $data2 = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')->select('scan.cname', 'customers.id as id', 'customers.customername as name', ScanningModel::raw('MAX(scan.id) as max_id'))->where('status','pending')->groupBy('scan.cname', 'customers.id', 'customers.customername')->get();
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $datawork=ScanningModel::select('worktype')->where('status','pending')->groupBy('worktype')->get();
        $dataproject=ScanningModel::select('description')->where('status','pending')->groupBy('description')->get();
        return view('scanning.dashboarddata',compact('data2','datawork','dataproject','currentDateTime'));
    }
    public function getselecteddashboarddata(Request $request)
    {
        if ($request->ajax()) {
            if (Auth::user()->role == "0" || Auth::user()->role == "1") {
                if (($request->has('customerids') && $request->customerids != "") || ($request->has('worktype') && $request->worktype != "") || ($request->has('descriptiondata') && $request->descriptiondata != "") || ($request->has('maindate') && $request->maindate != "")) {
                    $query = ScanningModel::where("status","pending");
                    if ($request->has('customerids') && $request->customerids != "") {
                        $customerIds = explode(',', $request->customerids);
                        $query->whereIn('cname', $customerIds);
                    }
                    if ($request->has('worktype') && $request->worktype != "") {
                        $worktype = explode(',', $request->worktype);
                        $query->whereIn('worktype', $worktype);
                    }
                    if ($request->has('descriptiondata') && $request->descriptiondata != "") {
                        $descriptionData = explode(',', $request->descriptiondata);
                        $query->whereIn('description', $descriptionData);
                    }
                    if ($request->has('maindate') && $request->maindate != "") {
                        $maindate = explode(',', $request->maindate);
                        $formattedDates = array_map(function ($maindate) {
                            return Carbon::createFromFormat("d/m/Y", $maindate)->format('Y-m-d');
                        }, $maindate);
                        $query->whereIn('rdate', $formattedDates);
                    }
                    $data = $query->get();
                } else {
                    $data = ScanningModel::where("status","pending")->get();
                }
            }
            
        return DataTables::of($data)
        ->addIndexColumn()  
        ->addColumn('cname',function($row){
            $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
            $custname="";
            if($data1->count()>0){
                foreach ($data1 as $key => $value) {
                    # code...
                    $custname=$value->customername;
                }
                
            }
            return $custname;
        })
        ->addColumn('rdate',function($row){
            // dd($row->rdate);
            return [
                // 'display' => e(Carbon::createFromFormat("d/m/Y", $row->rdate)->format('Y-m-d')),
                'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                'timestamp' => $row->rdate
             ];
            // return Carbon::parse($row->rdate)->format('d-m-Y');
        })
        ->addColumn('cdate',function($row){
            // dd($row->rdate);
            return [
                // 'display' => e(Carbon::createFromFormat("d/m/Y", $row->rdate)->format('Y-m-d')),
                'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                'timestamp' => $row->rdate
             ];
            // return Carbon::parse($row->rdate)->format('d-m-Y');
        })     
        ->make(true);
        }
    }
    public function dropdowninitialsmobile(Request $request){
       if($request->userid == 1){
            $userdata = UserModel::select('id','initials')->where('status','1')->get();
       }
        else{
            $userdata = UserModel::select('id','initials')->where('status','1')->where('id',$request->userid)->get();
        }    
        return response()->json(['status'=>true,'data' => $userdata], 200);
    }
    public function indexmobile(Request $request){
        $data = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')
        ->leftJoin('subplate', 'scan.id', '=', 'subplate.projectid')
        ->select('scan.*', 'customers.customername','customers.initials')
        ->where("status", "pending")
        ->where("worktype", "<>", "Sample")
        // ->with('subplates')
        ->distinct('scan.id') // Apply distinct on the 'scan.id' column
        
        
        ->get();
       
        foreach ($data as $key => $entry) {
            // Check if there are any related SubplateModel rows with null or 0 in packing_workby
            $hasNullOrZeroPackingWorkby = SubplateModel::where('projectid', $entry->id)
                ->where(function ($query) {
                    $query->whereNull('packing_workby')
                        ->orWhere('packing_workby', 0);
                })
                ->exists();
        
            // Set isnull to 0 if any related SubplateModel row has null or 0 in packing_workby, otherwise set it to 1
            $data[$key]->isnull = $hasNullOrZeroPackingWorkby ? 0 : 1;
        }
        
        // Now, your $data array contains an 'isnull' property for each entry.
        return response()->json(['status' => true, 'data' => $data], 200);
        
    // $data = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')->leftJoin('subplate', 'scan.id', '=', 'subplate.projectid')->select('scan.*','customers.customername')->where("status","pending")->where("worktype","<>","Sample")->get();
    // return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function getsubplatedata(Request $request)
    {
        $res="";
        if($request->subprojectid){
            $data =SubplateModel::select('subprojectid','material','length','width','height','sqty')
            ->where('subprojectid', $request->subprojectid)
            ->get();
            // $res='<option value="">Select Project</option>';
            $res = $data;
        }
        return $res;
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ScanningModel::latest()->where("status","pending")->get();
            $start = $request->input('start', 0); // Get the start index of the pagination
            $length = $request->input('length',50); // Get the length of data to be fetched

            $query = ScanningModel::where("worktype","<>","Sample")->where("status","pending")->with('subplates')->orderBy('rdate','DESC');
            $recordsTotal = $query->count(); // Total count of records
            $recordsFiltered = $recordsTotal = $query->count();

            $data = $query->offset($start)
                ->skip($start)
                ->take($length)
                ->limit($length);
            //  dd($data);   
            return DataTables::of($data)
            ->addIndexColumn()
            ->setTotalRecords($recordsTotal) // Set the total count of records
            ->setFilteredRecords($recordsFiltered) // Set the total count of filtered records
            ->addIndexColumn()
            ->addColumn('cdate',function($row){
                return [
                    'display' => Carbon::parse($row->cdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->cdate)->timestamp,
                ];
               // return Carbon::parse($row->cdate)->format('d-m-Y');
            })   
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $cname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $cname=$value->initials;
                    }  
                }
                return $cname;
            })           
            ->addColumn('rdate',function($row){
                return [
                    'display' => Carbon::parse($row->rdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->rdate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            
            ->addColumn('scan_by', function($row){
               $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn3 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="scanby_'.$row->id.'" onchange="return changestatusscan(\'scan_by\',this.value,\''.$row->id.'\');">';
                $btn3.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->scan_by){
                        $btn3.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn3.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn3.= '</select>';

                 return $btn3;
            })
            ->addColumn('qc_by', function($row){

                $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qc_'.$row->id.'" onchange="return changestatusscan(\'qc_by\',this.value,\''.$row->id.'\');">';
                $btn2.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->qc_by){
                        $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn2.= '</select>';

                 return $btn2;
            })
            ->addColumn('modeldesign_by', function($row){

                $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn1 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="modeldesign_'.$row->id.'" onchange="return changestatusscan(\'modeldesign_by\',this.value,\''.$row->id.'\');">';
                $btn1.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->modeldesign_by){
                        $btn1.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn1.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn1.= '</select>';

                 return $btn1;
            })
            ->addColumn('amount', function($row){

                $btn = '<input type="text" class="form-control" style="padding:0px;!important" id="amount_'.$row->id.'"  value="'.$row->amount.'" onblur="return changeamount(\''.$row->id.'\');">';

                 return $btn;
         })
            // ->addColumn('subnote', function($row){

            //     $btn = '<input type="text" class="form-control" style="padding:0px;!important" id="subnote_'.$row->id.'"  value="'.$row->subnote.'" onblur="return changesubnote(\''.$row->id.'\');">';

            //     return $btn;
            // })
            // ->addColumn('subnote', function($row){
            //     $btn = '<span class="subnote-label" id="subnote_label_'.$row->id.'" onclick="editSubnote('.$row->id.')">'.$row->subnote.'</span>';
            //     $btn .= '<input type="text" class="form-control subnote-input" style="padding:0px; display:none;" id="subnote_'.$row->id.'" value="'.$row->subnote.'" onblur="changesubnote('.$row->id.')">';
            //     return $btn;
            // })
            ->addColumn('subnote', function($row){
                $subnote = $row->subnote ?? ''; // In case subnote is null
                $btn = '<span class="subnote-label" id="subnote_label_'.$row->id.'" onclick="editSubnote('.$row->id.')">'.($subnote ? $subnote : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;').'</span>';
                $btn .= '<input type="text" class="form-control subnote-input" style="padding:0px; display:none;" id="subnote_'.$row->id.'" value="'.$subnote.'" onblur="changesubnote('.$row->id.')" autocomplete="off">';
                return $btn;
            })
            ->addColumn('mail_done', function($row){

                   $btn = '<input class="form-check-input" type="checkbox" id="formCheckcolor1" onchange="return changestatus(this,\''.$row->id.'\');"><span id="formError'.$row->id.'" style="color:red"></span>';

                    return $btn;
            })
            ->addColumn('note', function($row){
                $row->note=str_replace("\"","<>",$row->note);
                $btn = '<a href="javascript:View('.htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8').')" class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" title="View Plates"><i class="fa fa-eye"></i><a>';
                return $btn;
                // javascript:Edit(' . htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8') . ')
                // $btn = '<a href="javascript:View(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')"class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" title="View Plates"><i class="fa fa-eye"></i><a>';
                //  return $btn;
         })
            // ->addColumn('qc_by', function($row){

            //     $data1 = UserModel::latest()->where("role","1")->get();
                
            //     $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qc_'.$row->id.'">';
            //     $btn2.='<option value="0">Select</option>';
            //     foreach ($data1 as $key => $value) {
            //         # code...
            //         if($value->id==$row->qc_by){
            //             $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
            //          }else{
            //          $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
            //          }
            //     }
            //     $btn2.= '</select>';

            //      return $btn2;
            // })
            // ->addColumn("scan_hr",function($row){
            //     $data = WorkModel::where('scan_print_id',$row->id)->get();
            //     $scanhr=0;
            //     foreach($data as $val){
            //         $scanhr+=$val->scan_hr;
            //     }
            //     return $scanhr;
            // })
            // ->addColumn("sm_hr",function($row){

            //     $data = WorkModel::join('users as S2', 'worklog.userid', '=', 'S2.id')
            //    // ->select(WorkModel::raw('SUM(worklog.design_hr + worklog.program_hr + worklog.machine_hr + worklog.driltap_hr + worklog.qc_hr) as total_hours'), 'worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->select(WorkModel::raw('SUM(worklog.design_hr + worklog.program_hr + worklog.machine_hr + worklog.driltap_hr + worklog.qc_hr) as total_hours'), 'worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype')
            //     ->where('worklog.scan_print_id', $row->id)
            //     ->where('S2.usersubtype', 'Skilled MP')
            //    // ->where('S2.usertype', 'Manager')
            //     //->groupBy('worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->groupBy('worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype')
            //     ->get();
            

            //     //$data = WorkModel::where('scan_print_id',$row->id)->get();
            //    // dd($data);
            //     $scanhr=0;
            //     foreach($data as $val){
            //         //$scanhr+=$val->design_hr+$val->program_hr+$val->machine_hr+$val->driltap_hr+$val->qc_hr;
            //         $scanhr+=$val->total_hours;
            //     }
            //     return $scanhr;
            // })
            // ->addColumn("usm_hr",function($row){

            //     $data = WorkModel::join('users as S2', 'worklog.userid', '=', 'S2.id')
            //     ->select(WorkModel::raw('SUM(worklog.design_hr + worklog.program_hr + worklog.machine_hr + worklog.driltap_hr + worklog.qc_hr) as total_hours'), 'worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->where('worklog.scan_print_id', $row->id)
            //     ->where('S2.usersubtype', 'Unskilled MP')
            //     ->where('S2.usertype', 'User')
            //     ->groupBy('worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->get();
            

            //     //$data = WorkModel::where('scan_print_id',$row->id)->get();
            //    // dd($data);
            //     $scanhr=0;
            //     foreach($data as $val){
            //         //$scanhr+=$val->design_hr+$val->program_hr+$val->machine_hr+$val->driltap_hr+$val->qc_hr;
            //         $scanhr+=$val->total_hours;
            //     }
            //     return $scanhr;
            // })
            ->addColumn("m_hr", function ($row) {
                $data = WorkModel::select(WorkModel::raw('SEC_TO_TIME(SUM(TIME_TO_SEC(worklog.work_hr))) as total_time'), 'worklog.scan_print_id')
                    ->where('worklog.scan_print_id', $row->id)
                    ->groupBy('worklog.scan_print_id')
                    ->get();
            
                $scanTime = '00:00';
            
                if (!$data->isEmpty()) {
                    $scanTimeParts = explode(':', $data[0]->total_time);
                    $hours = (int)$scanTimeParts[0];
                    $minutes = (int)$scanTimeParts[1];
            
                    // Ensure hours do not exceed 24
                    // $hours %= 24;
            
                    $scanTime = sprintf("%02d:%02d", $hours, $minutes);
                }
                return $scanTime;
            })
            
            // ->addColumn("m_hr",function($row){

            //     $data = WorkModel::join('users as S2', 'worklog.userid', '=', 'S2.id')
            //     ->select(WorkModel::raw('SUM(worklog.work_hr) as total_hours'), 'worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->where('worklog.scan_print_id', $row->id)
            //     ->where('S2.usersubtype', 'Machine')
            //     ->where('S2.usertype', 'User')
            //     ->groupBy('worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->get();
            

            //     //$data = WorkModel::where('scan_print_id',$row->id)->get();
            //    // dd($data);
            //     $scanhr=0;
            //     foreach($data as $val){
            //         //$scanhr+=$val->design_hr+$val->program_hr+$val->machine_hr+$val->driltap_hr+$val->qc_hr;
            //         $scanhr+=$val->total_hours;
            //     }
            //     return $scanhr;
            // })
            ->addColumn('dswork', function($row){

                $btn = '<div class="row"><div class="col form-check-danger"><input class="form-check-input" type="checkbox" id="formCheckcolorm1" checked></div></div>';
                 return $btn;
            })
            ->addColumn('mowork', function($row){

                $btn = '<div class="row"><div class="col form-check-success2"><input class="form-check-input" type="checkbox" id="formCheckcolorm2" checked></div></div>';
                 return $btn;
            })
            ->addColumn('mwork', function($row){

                $btn = '<div class="row"><div class="col"><input class="form-check-input" type="checkbox" id="formCheckcolor3" checked></div>';
                $btn .= '<div class="col form-check form-checkbox-outline form-check-primary mb-3">
                <input class="form-check-input" type="checkbox" id="customCheckcolor1" checked="">
            </div></div>';
          
                 return $btn;
         })
         
         ->addColumn('vwork', function($row){

            $btn = '<div class="row"><div class="col form-check-warning"><input class="form-check-input" type="checkbox" id="formCheckcolorm4" checked></div>';
            $btn .= '<div class="col form-check form-checkbox-outline form-check-warning mb-3">
            <input class="form-check-input" type="checkbox" id="customCheckcolor1" checked="">
        </div></div>';
      
             return $btn;
        })
           
        ->addColumn('dwork', function($row){

            $btn = '<div class="row"><div class="col form-check-info"><input class="form-check-input" type="checkbox" id="formCheckcolorm5" checked></div>';
            $btn .= '<div class="col form-check form-checkbox-outline form-check-info mb-3">
            <input class="form-check-input" type="checkbox" id="customCheckcolor1" checked="">
        </div></div>';
      
             return $btn;
        })
        ->addColumn('pwork', function($row){
            
            $btn = '<div class="row"><div class="col form-check-success"><input class="form-check-input" type="checkbox" id="formCheckcolorm6" checked></div>';
            $btn .= '<div class="col form-check form-checkbox-outline form-check-success mb-3">
            <input class="form-check-input" type="checkbox" id="customCheckcolor1" checked="">
        </div></div>';
      
             return $btn;
        })
        ->addColumn('fwork', function($row){

            $btn = '<div class="row"><div class="col form-check-success1"><input class="form-check-input" type="checkbox" id="formCheckcolorm7" checked></div></div>';
             return $btn;
        })
        ->addColumn('action', function($row){
            $rdate = Carbon::parse($row->rdate);
            $row->rdate=$rdate->format('d/m/Y');
            $cdate = Carbon::parse($row->cdate);
            $row->cdate=$cdate->format('d/m/Y');
            $row->description=str_replace("\"","<>",$row->description);
            $row->note=str_replace("\"","<>",$row->note);
            // $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;margin-right: 2px;" href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\')">Edit</a>';
            $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px; padding-left: 10px; margin-right: 2px;" href="javascript:Edit(' . htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8') . ')">Edit</a>';
            $btn .= '<a class="btn btn-outline-danger waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px; margin-right: 2px;" href="javascript:scanDelete(\''.$row->id.'\')">Delete</a>';
            // $btn .= '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:View(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" >View</a>';
                $btn .= '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:void(0)" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" projectid="'.$row->projectid.'" onclick="openModal(`'.$row->projectid.'`,`'.$row->id.'`,`'.count($row->subplates).'`)">Add Plate</a>';
                 return $btn;
         })
         ->setRowId(function($row){

             return "scan_".$row->id;
           })
            ->rawColumns(['mail_done','note', 'subnote', 'scan_by','qc_by','modeldesign_by','action','amount','mwork','vwork','dwork','pwork','fwork','dswork','mowork'])
            
            ->make(true);
          //  return $data;                          
        }
    }
    public function updatesubnote(Request $request){
        // dd($request);
         $model=ScanningModel::findOrFail($request->id);
         $model->subnote=$request->subnote;
         $model->updated_by=Auth::user()->role;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
     }
    public function getcustomerprojectdata(Request $request){
        try
        {
                
                $data=ScanningModel::select("description","worktype")->where("cname",$request->cid)->where("projectid",$request->projectid)->get();  
                return response()->json(['status'=>true, 'data'=>$data], 200);
        }
        catch(\Illuminate\Database\QueryException $ex)
        { 
            $error="Something went wrong. Try after sometime.";
            foreach ($ex->getPrevious()->errorInfo as $key => $value) {
                # code...
                if(strlen($value)>7){
                    $error=$value;
                }
            }
                return response()->json(['status'=>false,'message' => $error], 200);
                // Note any method of class PDOException can be called on $ex.
        }
    }
    public function projectlist(Request $request){
        try
        {
                
                $data=ScanningModel::select("projectid")->where("cname",$request->cid)->get();  
                return response()->json(['status'=>true, 'data'=>$data], 200);
        }
        catch(\Illuminate\Database\QueryException $ex)
        { 
            $error="Something went wrong. Try after sometime.";
            foreach ($ex->getPrevious()->errorInfo as $key => $value) {
                # code...
                if(strlen($value)>7){
                    $error=$value;
                }
            }
                return response()->json(['status'=>false,'message' => $error], 200);
                // Note any method of class PDOException can be called on $ex.
        }
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        // 
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function addscandata(Request $request)
    {  
        try
        {   
            if($request->id!=""){
                $model=ScanningModel::findOrFail($request->id);
                
                $model->cname=$request->cname;
                //$datac = ScanningModel::select('*')->where('cname', $request->cname);
               // $totalproject=$datac->count()+1;
                //$model->projectid="S".$totalproject;
                $model->rdate=Carbon::createFromFormat('d-m-Y', $request->rdate)->format('Y-m-d');
                $model->cdate=Carbon::createFromFormat('d-m-Y', $request->cdate)->format('Y-m-d');
                $model->description=$request->description;
                $model->note=$request->note;
                $model->scan_by=0;
                $model->qc_by=0;
                $model->modeldesign_by=0;
                $model->sr_scanhr=0;
                $model->sr_modelhr=0;
                $model->amount=0; 
                $model->mail_done=0;
                $model->payment=0;
                $model->worktype=$request->worktype;
                $model->scan_hr=0;
                $model->model_hr=0;  
                $model->save();
                return response()->json(['status'=>true,'message'=>"Data updated successfully",'data' => $model], 200);
               }
               else{
                // $model=new ScanningModel();
                // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
                // $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->cdate));
                // $model->cname=$request->cname;
                // $datac = ScanningModel::select('*')->where('cname', $request->cname);
                // $totalproject=$datac->count()+1;
                // $model->projectid="S".$totalproject;
                // $model->description=$request->description;
                // $model->scan_by=0;
                // $model->qc_by=0;
                // $model->modeldesign_by=0;
                // $model->sr_scanhr=0;
                // $model->sr_modelhr=0;
                // $model->amount=0; 
                // $model->mail_done=0;
                // $model->payment=0;
                // $model->worktype=$request->worktype;
                // $model->scan_hr=0;
                // $model->model_hr=0;
                // $model->save();

                $model=new ScanningModel();
                $model->rdate=Carbon::createFromFormat('d-m-Y', $request->rdate)->format('Y-m-d');
                $model->cdate=Carbon::createFromFormat('d-m-Y', $request->cdate)->format('Y-m-d');
                $model->cname=$request->cname;
                $model->description=$request->description;
                $model->note=$request->note;
                $model->scan_by=0;
                $model->qc_by=0;
                $model->modeldesign_by=0;
                $model->sr_scanhr=0;
                $model->sr_modelhr=0;
                $model->amount=0; 
                $model->mail_done=0;
                $model->payment=0;
                $model->worktype=$request->worktype;
                $model->scan_hr=0;
                $model->model_hr=0;

                // Retrieve the customer initial and count the number of projects
                $customer = CustomerModel::select('initials')
                    ->where('id', $request->cname)
                    ->first();
                $count = ScanningModel::where('cname', $request->cname)->count() + 1;

                // Generate the project ID with the customer initial and project count
                $projectCountStr = str_pad($count, 3, '0', STR_PAD_LEFT);
                $maxId = ScanningModel::max('id');
                $cid = $maxId + 1;
                if ($cid <= 9999) {
                    $projectCountStr1 = sprintf("%04d", $cid); // Four-digit number with leading zeros
                } else {
                    $projectCountStr1 = sprintf("%d", $cid); // Four-digit number without leading zeros
                }
                $model->projectid = $projectCountStr1.'_'.$customer->initials .'_' . $projectCountStr;

                $model->save();
                return response()->json(['status'=>true,'message'=>"Data inserted successfully ",'data' => $model], 200);
               } 
       } 
       catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
        //
       // $da=Carbon::parse($request->rdate)->format('Y-m-d');
       // dd($da);
        // return redirect(route('scanlist'));
        // dd($request);
    }
    public function store(Request $request)
    {
        //
       // $da=Carbon::parse($request->rdate)->format('Y-m-d');
       // dd($da);
       if($request->id!=""){
        $model=ScanningModel::findOrFail($request->id);
        
        $model->cname=$request->cname;
        //$datac = ScanningModel::select('*')->where('cname', $request->cname);
       // $totalproject=$datac->count()+1;
        //$model->projectid="S".$totalproject;
        $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');
        $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate)->format('Y-m-d');
        $model->description=$request->description;
        $model->note=$request->note;
        $model->scan_by=0;
        $model->qc_by=0;
        $model->modeldesign_by=0;
        $model->sr_scanhr=0;
        $model->sr_modelhr=0;
        $model->amount=0; 
        $model->mail_done=0;
        $model->payment=0;
        $model->worktype=$request->worktype;
        $model->scan_hr=0;
        $model->model_hr=0;  
        $model->created_by=Auth::user()->id;
        $model->save();
       }
       else{
        // $model=new ScanningModel();
        // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
        // $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->cdate));
        // $model->cname=$request->cname;
        // $datac = ScanningModel::select('*')->where('cname', $request->cname);
        // $totalproject=$datac->count()+1;
        // $model->projectid="S".$totalproject;
        // $model->description=$request->description;
        // $model->scan_by=0;
        // $model->qc_by=0;
        // $model->modeldesign_by=0;
        // $model->sr_scanhr=0;
        // $model->sr_modelhr=0;
        // $model->amount=0; 
        // $model->mail_done=0;
        // $model->payment=0;
        // $model->worktype=$request->worktype;
        // $model->scan_hr=0;
        // $model->model_hr=0;
        // $model->save();


        // $model=new ScanningModel();
        // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');
        // $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate)->format('Y-m-d');
        // $model->cname=$request->cname;
        // $model->description=$request->description;
        // $model->scan_by=0;
        // $model->qc_by=0;
        // $model->modeldesign_by=0;
        // $model->sr_scanhr=0;
        // $model->sr_modelhr=0;
        // $model->amount=0; 
        // $model->mail_done=0;
        // $model->payment=0;
        // $model->worktype=$request->worktype;
        // $model->scan_hr=0;
        // $model->model_hr=0;
        
        // // Retrieve the customer initial and count the number of projects
        // $customer = CustomerModel::select('initials')
        //     ->where('id', $request->cname)
        //     ->first();
        // $count = ScanningModel::where('cname', $request->cname)->count() + 1;
        
        // // Generate the project ID with the customer initial and project count
        // $model->projectid = $customer->initials . $count;
        
        // $model->save();



        
                $model=new ScanningModel();
                $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');
                $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate)->format('Y-m-d');
                $model->cname=$request->cname;
                $model->description=$request->description;
                $model->note=$request->note;
                $model->scan_by=0;
                $model->qc_by=0;
                $model->modeldesign_by=0;
                $model->sr_scanhr=0;
                $model->sr_modelhr=0;
                $model->amount=0; 
                $model->mail_done=0;
                $model->payment=0;
                $model->worktype=$request->worktype;
                $model->scan_hr=0;
                $model->model_hr=0;
                $model->created_by=Auth::user()->id;
                // Retrieve the customer initial and count the number of projects
                $customer = CustomerModel::select('initials')
                    ->where('id', $request->cname)
                    ->first();
                $count = ScanningModel::where('cname', $request->cname)->count() + 1;

                // Generate the project ID with the customer initial and project count
                $projectCountStr = str_pad($count, 3, '0', STR_PAD_LEFT);
                $maxId = ScanningModel::max('id');
                $cid = $maxId + 1;
                if ($cid <= 9999) {
                    $projectCountStr1 = sprintf("%04d", $cid); // Four-digit number with leading zeros
                } else {
                    $projectCountStr1 = sprintf("%d", $cid); // Four-digit number without leading zeros
                }
                $model->projectid = $projectCountStr1.'_'.$customer->initials .'_' . $projectCountStr;
                $model->save();


       }
        
        return redirect(route('scanlist'));
        // dd($request);
    }
    // public function updateamount(Request $request){
    //     // dd($request);
    //      $model=ScanningModel::findOrFail($request->id);
    //      $model->amount=$request->amount;
    //      $model->updated_by=Auth::user()->role;
    //      $model->updated_at=Carbon::now()->toDateTimeString();
    //      $model->save();
    //  }
    public function updatestatusscan(Request $request)
    {
        // dd($request);
         $model=ScanningModel::findOrFail($request->id);
         if($request->field=="scan_by"){
            $model->scan_by=$request->value;
         }else if($request->field=="qc_by"){
            $model->qc_by=$request->value;
         }else if($request->field=="modeldesign_by"){
            $model->modeldesign_by=$request->value;
         }
         $model->updated_by=Auth::user()->id;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
         $data["samplecount"] = ScanningModel::where('status','pending')->where('worktype','Sample')->count();
         $data["scantotal"] = ScanningModel::where('status','pending')->count();
         $data["printtotal"] = PrintingModel::where('status','pending')->count();
         $data["scanby"] = ScanningModel::where('scan_by',0)->where('status','pending')->count();
         $data["qcby"] = ScanningModel::where('qc_by',0)->where('status','pending')->count();
         $data["designby"] = ScanningModel::where('modeldesign_by',0)->where('status','pending')->count();
         $data["printby"] = PrintingModel::where('print_by',0)->where('status','pending')->count();
         $data["printqc"] = PrintingModel::where('qc_by',0)->where('status','pending')->count();
         print_r(json_encode($data));
    }
    
     public function scancount(Request $request)
    {
        try{
            $data["samplecount"] = ScanningModel::where('status','pending')->where('worktype','Sample')->count();
            $data["scantotal"] = ScanningModel::where('status','pending')->count();
            $data["designby"] = SubplateModel::select('design_by')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('design_by','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["orderby"] = SubplateModel::select('order_by')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('order_by','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["receivedworkby"] = SubplateModel::select('received_workby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('received_workby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["receivedqcby"] = SubplateModel::select('received_qcby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('received_qcby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["vmcworkby"] = SubplateModel::select('vmc_workby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('vmc_workby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["vmcqcby"] = SubplateModel::select('vmc_qcby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('vmc_qcby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["drilltapworkby"] = SubplateModel::select('drilltap_workby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('drilltap_workby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["finalqcby"] = SubplateModel::select('final_qcby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('final_qcby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
            $data["packingworkby"] = SubplateModel::select('packing_workby')
            ->join('scan as s', 's.id', '=', 'subplate.projectid')
            ->where('packing_workby','=', NULL)
            ->where('s.status', 'pending')
            ->count();
                // $data =WorkModel::select('worklog.*,(selectRaw(customername from customers where customers.id=worklog.customerid))as customername')->get();
                return response()->json(['status'=>true,'data' => $data], 200);
            }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       } 
            
    }
    //  public function updatestatusqc(Request $request){
    //     // dd($request);
    //      $model=ScanningModel::findOrFail($request->id);
    //      $model->qc_by=$request->qc;
    //      $model->updated_by=Auth::user()->id;
    //      $model->updated_at=Carbon::now()->toDateTimeString();
    //      $model->save();
    //  }
    //  public function updatestatusdesign(Request $request){
    //     // dd($request);
    //      $model=ScanningModel::findOrFail($request->id);
    //      $model->modeldesign_by=$request->modeldesign;

    //      $model->updated_by=Auth::user()->id;
    //      $model->updated_at=Carbon::now()->toDateTimeString();
    //      $model->save();
    //  }
    public function updatestatus(Request $request)
    {
       // dd($request);
       $datatemp = SubplateModel::where('projectid',$request->id)->get();
       $temp=false;
       $data["message"]="";
        foreach ($datatemp as $key => $value) {
            if($value["packing_workby"]==null){
                $temp=true;
                $data["message"]="Packing work is pending.";
                break;
            }
            if($value["location"]!="SM")
            {
                $temp=true;
                $data["message"]="One or more subplate is out of Star Mould.";
                break;
            }
        }
        if(!$temp){
        $model=ScanningModel::findOrFail($request->id);
        // $model->scan_by=$request->scan;
        // $model->qc_by=$request->qc;
        // $model->modeldesign_by=$request->modeldesign;
        $model->status=$request->status;
        // $model->amount=$request->amount;
        $model->mail_done=1;
        $model->updated_by=Auth::user()->id;
        $model->updated_at=Carbon::now()->toDateTimeString();
        $model->dispatchdate=Carbon::now()->format('Y-m-d');
        $model->save();
        $data["status"] = true;
        $data["scantotal"] = ScanningModel::where('status','pending')->count();
        $data["samplecount"] = ScanningModel::where('status','pending')->where('worktype','Sample')->count();
        print_r(json_encode($data));
        }else{
            $data["status"] = false;
            print_r(json_encode($data));
        }
    }
    public function updatestatusmobile(Request $request)
    {
        try{
            $model=ScanningModel::findOrFail($request->id);
            $model->status=$request->status;
            $model->mail_done=1;
            $model->updated_by=Auth::user()->id;
            $model->updated_at=Carbon::now()->toDateTimeString();
            $model->save();
                      return response()->json(['status'=>true,'message' =>"Data updated successfully"], 200);
            }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       } 
            
    }
    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        //
        // $data=ScanningModel::findOrFail($id);
        // return view('scanning/edit',["scanning"=>$data])->render();
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request)
    {
        print_r($request->id);
        //
        // $model=ScanningModel::findOrFail($request->id);
        // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
        // $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->cdate));
        // $model->cname=$request->cname;
        // $model->description=$request->description;
        // $model->scan_by='';
        // $model->qc_by='';
        // $model->modeldesign_by='';
        // // $model->mail_done=0;
        // $model->worktype=$request->worktype;
        // $model->scan_hr=0;
        // $model->model_hr=0;
        // $model->save();
        // return redirect(route('scanlist'));
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
        $model=ScanningModel::where("id", $id)->update(["status" => "completed"]);
        return redirect(route('scanning.index'));
    }

    public function addPlatesmobile(Request $request){
        // dd($request);
        // $request->validate([
        //     'mainprojectid' => 'required|integer',
        //     'plates.*.platename' => 'required|string',
        //     'plates.*.subproject' => 'required|string',
        //     'plates.*.length' => 'required|numeric',
        //     'plates.*.height' => 'required|numeric',
        //     'plates.*.weight' => 'required|numeric',
        //     'plates.*.photo' => 'required|file|mimes:jpeg,png,jpg,gif,svg|max:2048',
        //     'plates.*.designing' => 'required|integer',
        //     'plates.*.MO' => 'required|integer',
        //     'plates.*.MRinit1' => 'required|integer',
        //     'plates.*.MRinit2' => 'required|integer',
        //     'plates.*.VMCinit1' => 'required|integer',
        //     'plates.*.VMCinit2' => 'required|integer',
        //     'plates.*.DTinit1' => 'required|integer',
        //     'plates.*.DTinit2' => 'required|integer',
        //     'plates.*.FQC' => 'required|integer',
        //     'plates.*.packinginit1' => 'required|integer',
        //     'plates.*.packingphoto' => 'required|file|mimes:jpeg,png,jpg,gif,svg|max:2048',
        // ]);
        try {
            $allrequestdata = $request->all();
            //  dd($allrequestdata);
            isset($allrequestdata['plates']) ? $plates = $allrequestdata : $plates['plates'][] = $allrequestdata;
            if(isset($plates['plates'])){
                $successfulInserts = 0;
                // $totalInserts = count($request->plates ?? []);
                
                $totalInserts = count($plates['plates']);
                $actualprojectid = $request->actualprojectid;
                
                foreach ($plates['plates'] as $kk=>$plate) {
                    $packingPhotoName = "";
                    $photoName = "";
                    
                    if($totalInserts>1){
                        if(isset($request->file('plates')[$kk]['photo'])){
                            $photo =$request->file('plates')[$kk]['photo'];
                            $photoName = time() . '-' . $plate['platename'] . '.' . $photo->getClientOriginalExtension();
                            $photo->move(public_path('images').'/subplates/', $photoName);
                        }
                        if(isset($request->file('plates')[$kk]['packingphoto'])){
                            $packingPhoto = $request->file('plates')[$kk]['packingphoto'];
                            $packingPhotoName = time() . '-packing-' . $plate['platename'] . '.' . $packingPhoto->getClientOriginalExtension();
                            $packingPhoto->move(public_path('images').'/subplates/', $packingPhotoName);
                        }
                    }else{
                        if($request->file('photo')!=null){
                            $photo =$request->file('photo');
                            $photoName = time() . '-' . $plate['platename'] . '.' . $photo->getClientOriginalExtension();
                            $photo->move(public_path('images').'/subplates/', $photoName);
                        }
                        if($request->file('packingphoto')!=null){
                            $packingPhoto = $request->file('packingphoto');
                            $packingPhotoName = time() . '-packing-' . $plate['platename'] . '.' . $packingPhoto->getClientOriginalExtension();
                            $packingPhoto->move(public_path('images').'/subplates/', $packingPhotoName);
                        }
                    }
                    $data_array = [
                        'platename' => $plate['platename'],
                        'projectid' => $actualprojectid,
                    // 'projectid' => $request->mainprojectid,
                        'subprojectid' => $plate['subproject'],
                        'length' => isset($plate['length']) && !empty($plate['length']) ? $plate['length'] : 0,
                        'width' => isset($plate['width']) && !empty($plate['width']) ? $plate['width'] : 0,
                        'height' => isset($plate['height']) && !empty($plate['height']) ? $plate['height'] : 0,
                        'unit' => $plate['unit'],
                        'shape' => $plate['shape'],
                        'material' => $plate['material'],
                        'weight' => isset($plate['weight']) && !empty($plate['weight']) ? $plate['weight'] : 0,
                        'sqty' => isset($plate['sqty']) && !empty($plate['sqty']) ? $plate['sqty'] : 0,
                        'photo' => isset($photoName) && !empty($photoName) ? $photoName : null,
                        // 'design_by' => isset($plate['designing']) && !empty($plate['designing']) ? $plate['designing'] : null,
                        // 'order_by' => isset($plate['MO']) && !empty($plate['MO']) ? $plate['MO'] : null,
                        // 'received_workby' => isset($plate['MRinit1']) && !empty($plate['MRinit1']) ? $plate['MRinit1'] : null,
                        // 'received_qcby' => isset($plate['MRinit2']) && !empty($plate['MRinit2']) ? $plate['MRinit2'] : null,
                        // 'vmc_workby' => isset($plate['VMCinit1']) && !empty($plate['VMCinit1']) ? $plate['VMCinit1'] : null,
                        // 'vmc_qcby' => isset($plate['VMCinit2']) && !empty($plate['VMCinit2']) ? $plate['VMCinit2'] : null,
                        // 'drilltap_workby' => isset($plate['DTinit1']) && !empty($plate['DTinit1']) ? $plate['DTinit1'] : null,
                        // // 'driltap_qcby' => isset($plate['DTinit2']) && !empty($plate['DTinit2']) ? $plate['DTinit2'] : null,
                        // 'packing_workby' => isset($plate['packinginit1']) && !empty($plate['packinginit1']) ? $plate['packinginit1'] : null,
                        // 'final_qcby' => isset($plate['FQC']) && !empty($plate['FQC']) ? $plate['FQC'] : null,
                    ];
                    if(isset($request->file('plates')[$kk]['photo'])){
                        $data_array['photo'] = isset($photoName) && !empty($photoName) ? $photoName : null;
                    }elseif(!empty($plate['photo_name'])){
                        $data_array['photo'] = $plate['photo_name'];
                    }
                    if(isset($request->file('plates')[$kk]['packaging_photo'])){
                        $data_array['packing_photo'] = isset($packingPhotoName) && !empty($packingPhotoName) ? $packingPhotoName : null;
                    }
                //    dd($data_array);    
                    SubplateModel::updateOrCreate(['subprojectid'=>$plate['subproject']],$data_array);
                    $successfulInserts++;
                }
                if ($successfulInserts === $totalInserts) {
                    return response()->json(['status'=>true, 'message'=>"success", 'data'=>$data_array], 200);
                } else {
                    return response()->json(['status'=>false, 'message'=>"Some Subplates could not be added. Please check the data and try again.", 'data'=>$data_array], 200);
                }
                    
            }
        }
            // if ($successfulInserts === $totalInserts) {
                
            // } 
            // else {
            //     return redirect()->back()->with('warning', 'Some Subplates could not be added. Please check the data and try again.');
            // }
        catch (\Exception $exception) {
            dd("error".$exception->getMessage(),$exception->getLine());
            if(env('APP_DEBUG')){
                 $message = $exception->getMessage();
                $file = $exception->getFile();
                $line = $exception->getLine();
                $trace = $exception->getTraceAsString();

                $output = "Exception: $message\n";
                $output .= "File: $file\n";
                $output .= "Line: $line\n";
                $output .= "Stack Trace:\n$trace\n";
                exit;
                return response()->json(['status'=>false,'message' => $exception->getMessage()], 200);
               // return redirect()->back()->with('error', 'Failed to add Subplates. Please check the data and try again. Error: '.$e->getMessage());
            }
            // else{
            //     return redirect()->back()->with('error', 'Failed to add Subplates. Please check the data and try again.');
            // }
        }
    }
    public function addPlates(Request $request){
        // $request->validate([
        //     'mainprojectid' => 'required|integer',
        //     'plates.*.platename' => 'required|string',
        //     'plates.*.subproject' => 'required|string',
        //     'plates.*.length' => 'required|numeric',
        //     'plates.*.height' => 'required|numeric',
        //     'plates.*.weight' => 'required|numeric',
        //     'plates.*.photo' => 'required|file|mimes:jpeg,png,jpg,gif,svg|max:2048',
        //     'plates.*.designing' => 'required|integer',
        //     'plates.*.MO' => 'required|integer',
        //     'plates.*.MRinit1' => 'required|integer',
        //     'plates.*.MRinit2' => 'required|integer',
        //     'plates.*.VMCinit1' => 'required|integer',
        //     'plates.*.VMCinit2' => 'required|integer',
        //     'plates.*.DTinit1' => 'required|integer',
        //     'plates.*.DTinit2' => 'required|integer',
        //     'plates.*.FQC' => 'required|integer',
        //     'plates.*.packinginit1' => 'required|integer',
        //     'plates.*.packingphoto' => 'required|file|mimes:jpeg,png,jpg,gif,svg|max:2048',
        // ]);
        try {
            $allrequestdata = $request->all();
            //  dd($allrequestdata);
            isset($allrequestdata['plates']) ? $plates = $allrequestdata : $plates['plates'][] = $allrequestdata;
            if(isset($plates['plates'])){
                $successfulInserts = 0;
                // $totalInserts = count($request->plates ?? []);
                
                $totalInserts = count($plates['plates']);
                $actualprojectid = $request->actualprojectid;
                
                foreach ($plates['plates'] as $kk=>$plate) {
                    $packingPhotoName = "";
                    $photoName = "";
                    
                    if($totalInserts>1){
                        if(isset($request->file('plates')[$kk]['photo'])){
                            $photo =$request->file('plates')[$kk]['photo'];
                            $photoName = time() . '-' . $plate['platename'] . '.' . $photo->getClientOriginalExtension();
                            $photo->move(public_path('images').'/subplates/', $photoName);
                        }
                        if(isset($request->file('plates')[$kk]['packingphoto'])){
                            $packingPhoto = $request->file('plates')[$kk]['packingphoto'];
                            $packingPhotoName = time() . '-packing-' . $plate['platename'] . '.' . $packingPhoto->getClientOriginalExtension();
                            $packingPhoto->move(public_path('images').'/subplates/', $packingPhotoName);
                        }
                    }else{
                        if($request->file('photo')!=null){
                            $photo =$request->file('photo');
                            $photoName = time() . '-' . $plate['platename'] . '.' . $photo->getClientOriginalExtension();
                            $photo->move(public_path('images').'/subplates/', $photoName);
                        }
                        if($request->file('packingphoto')!=null){
                            $packingPhoto = $request->file('packingphoto');
                            $packingPhotoName = time() . '-packing-' . $plate['platename'] . '.' . $packingPhoto->getClientOriginalExtension();
                            $packingPhoto->move(public_path('images').'/subplates/', $packingPhotoName);
                        }
                    }
                    $data_array = [
                        'platename' => $plate['platename'],
                        'projectid' => $actualprojectid,
                    // 'projectid' => $request->mainprojectid,
                        'subprojectid' => $plate['subproject'],
                        'length' => isset($plate['length']) && !empty($plate['length']) ? $plate['length'] : 0,
                        'width' => isset($plate['width']) && !empty($plate['width']) ? $plate['width'] : 0,
                        'height' => isset($plate['height']) && !empty($plate['height']) ? $plate['height'] : 0,
                        'unit' => $plate['unit'],
                        'shape' => $plate['shape'],
                        'material' => $plate['material'],
                        'weight' => isset($plate['weight']) && !empty($plate['weight']) ? $plate['weight'] : 0,
                        'sqty' => isset($plate['sqty']) && !empty($plate['sqty']) ? $plate['sqty'] : 0,
                        'photo' => isset($photoName) && !empty($photoName) ? $photoName : null,
                        // 'design_by' => isset($plate['designing']) && !empty($plate['designing']) ? $plate['designing'] : null,
                        // 'order_by' => isset($plate['MO']) && !empty($plate['MO']) ? $plate['MO'] : null,
                        // 'received_workby' => isset($plate['MRinit1']) && !empty($plate['MRinit1']) ? $plate['MRinit1'] : null,
                        // 'received_qcby' => isset($plate['MRinit2']) && !empty($plate['MRinit2']) ? $plate['MRinit2'] : null,
                        // 'vmc_workby' => isset($plate['VMCinit1']) && !empty($plate['VMCinit1']) ? $plate['VMCinit1'] : null,
                        // 'vmc_qcby' => isset($plate['VMCinit2']) && !empty($plate['VMCinit2']) ? $plate['VMCinit2'] : null,
                        // 'drilltap_workby' => isset($plate['DTinit1']) && !empty($plate['DTinit1']) ? $plate['DTinit1'] : null,
                        // // 'driltap_qcby' => isset($plate['DTinit2']) && !empty($plate['DTinit2']) ? $plate['DTinit2'] : null,
                        // 'packing_workby' => isset($plate['packinginit1']) && !empty($plate['packinginit1']) ? $plate['packinginit1'] : null,
                        // 'final_qcby' => isset($plate['FQC']) && !empty($plate['FQC']) ? $plate['FQC'] : null,
                    ];
                    if(isset($request->file('plates')[$kk]['photo'])){
                        $data_array['photo'] = isset($photoName) && !empty($photoName) ? $photoName : null;
                    }elseif(!empty($plate['photo_name'])){
                        $data_array['photo'] = $plate['photo_name'];
                    }
                    if(isset($request->file('plates')[$kk]['packaging_photo'])){
                        $data_array['packing_photo'] = isset($packingPhotoName) && !empty($packingPhotoName) ? $packingPhotoName : null;
                    }
                //    dd($data_array);    
                    SubplateModel::updateOrCreate(['subprojectid'=>$plate['subproject']],$data_array);
                    $successfulInserts++;
                }
                if ($successfulInserts === $totalInserts) {
                    return redirect()->back()->with('success', 'Sub Plates added successfully!');
                } else {
                    return redirect()->back()->with('warning', 'Some Subplates could not be added. Please check the data and try again.');
                }
            }
            
        }catch (\Exception $exception) {
            dd("error".$exception->getMessage(),$exception->getLine());
            if(env('APP_DEBUG')){
                 $message = $exception->getMessage();
                $file = $exception->getFile();
                $line = $exception->getLine();
                $trace = $exception->getTraceAsString();

                $output = "Exception: $message\n";
                $output .= "File: $file\n";
                $output .= "Line: $line\n";
                $output .= "Stack Trace:\n$trace\n";
                exit;

                return redirect()->back()->with('error', 'Failed to add Subplates. Please check the data and try again. Error: '.$exception->getMessage());
            }else{
                return redirect()->back()->with('error', 'Failed to add Subplates. Please check the data and try again.');
            }
        }
    }
    public function getPlatesmobile(Request $request)
    {
        try
        {      
            $plates = SubPlateModel::where('projectid','=',$request->projectid)->get();
          //  return response()->json($plates);
            return response()->json(['status'=>true,'plates' => $plates], 200);          
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
    }
    public function getPlatesbyidmobile(Request $request)
    {
        try
        {      
            $plates = SubPlateModel::where('projectid','=',$request->projectid)->where('id','=',$request->id)->get();
          //  return response()->json($plates);
            return response()->json(['status'=>true,'plates' => $plates], 200);          
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
    }
    public function getPlates(Request $request){
        //write a code to get subplates from projectid 
        $plates = SubPlateModel::where('projectid','=',$request->projectid)->get();
        return response()->json($plates);
    }
    public function getsubPlates(Request $request){
        //write a code to get subplates from projectid 
        $plates = SubPlateModel::select('id','platename','projectid')->where('projectid','=',$request->projectid)->get();
        return $plates;
    }
    public function updatesubplatemobile(Request $request)
    {
        try
        {      
            if (!empty($request->sub_id)) {
                if($request->deleteimage == "true"){
                    $model=SubplateModel::findOrFail($request->sub_id);
                    $og_fieldname = str_replace('_[object HTMLInputElement]','',$request->get('field'));
                    if($og_fieldname=="photo"){
                        $model->$og_fieldname=null;
                     }else if($og_fieldname=="packing_photo"){
                        $model->$og_fieldname=null;
                     }
                     $model->updated_at=Carbon::now()->toDateTimeString();
                     $model->save();  

                     $data = SubplateModel::where('id',$request->sub_id)->get();
                     return response()->json(['status'=>true,'message'=>'Data updated successfully','data' => $data], 200);
                }
                $model=SubplateModel::findOrFail($request->sub_id);
                if($request->field=="design_by"){
                   $model->design_by=$request->value;
                }else if($request->field=="order_by"){
                   $model->order_by=$request->value;
                }else if($request->field=="received_workby"){
                   $model->received_workby=$request->value;  
                }else if($request->field=="received_qcby"){
                    $model->received_qcby=$request->value;  
                }else if($request->field=="vmc_workby"){
                    $model->vmc_workby=$request->value;  
                }else if($request->field=="vmc_qcby"){
                    $model->vmc_qcby=$request->value;  
                }else if($request->field=="drilltap_workby"){
                    $model->drilltap_workby=$request->value;  
                }else if($request->field=="final_qcby"){
                    $model->final_qcby=$request->value;  
                }else if($request->field=="packing_workby"){
                    $model->packing_workby=$request->value;  
                }
    
                if($request->file('value') != null){
                    $photo =$request->file('value');
                    $photoName = time() . '-' . $request->platename. '.' . $photo->getClientOriginalExtension();
                    $photo->move(public_path('images').'/subplates/', $photoName);
                    $og_fieldname = str_replace('_[object HTMLInputElement]','',$request->get('field'));
                    if($og_fieldname=="packing_photo"){
                        $model->packing_photo=$photoName;  
                    }else if($og_fieldname=="photo"){
                        $model->photo =$photoName;  
                    }
                }
                // $model->updated_by=Auth::user()->id;
                $model->updated_at=Carbon::now()->toDateTimeString();
                $model->save();  
            }
            return response()->json(['status'=>true,'message'=>'Data updated successfully'], 200);          
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
       
    }
    public function updatesubplate(Request $request)
    {
        if (!empty($request->sub_id)) {
            if($request->deleteimage == "true"){
                $model=SubplateModel::findOrFail($request->sub_id);
                $og_fieldname = str_replace('_[object HTMLInputElement]','',$request->get('field'));
                if($og_fieldname=="photo"){
                    $model->$og_fieldname=null;
                 }else if($og_fieldname=="packing_photo"){
                    $model->$og_fieldname=null;
                 }
                 $model->updated_at=Carbon::now()->toDateTimeString();
                 $model->save();  
                 $data = SubplateModel::where('id',$request->sub_id)->get();
                 return print_r(json_encode($data));
            }
            $model=SubplateModel::findOrFail($request->sub_id);
            if($request->field=="design_by"){
               $model->design_by=$request->value;
            }else if($request->field=="order_by"){
               $model->order_by=$request->value;
            }else if($request->field=="received_workby"){
               $model->received_workby=$request->value;  
            }else if($request->field=="received_qcby"){
                $model->received_qcby=$request->value;  
            }else if($request->field=="vmc_workby"){
                $model->vmc_workby=$request->value;  
            }else if($request->field=="vmc_qcby"){
                $model->vmc_qcby=$request->value;  
            }else if($request->field=="drilltap_workby"){
                $model->drilltap_workby=$request->value;  
            }else if($request->field=="final_qcby"){
                $model->final_qcby=$request->value;  
            }else if($request->field=="packing_workby"){
                $model->packing_workby=$request->value;  
            }

            if($request->file('value') != null){
                $photo =$request->file('value');
                $photoName = time() . '-' . $request->platename. '.' . $photo->getClientOriginalExtension();
                $photo->move(public_path('images').'/subplates/', $photoName);
                $og_fieldname = str_replace('_[object HTMLInputElement]','',$request->get('field'));
                if($og_fieldname=="packing_photo"){
                    $model->packing_photo=$photoName;  
                }else if($og_fieldname=="photo"){
                    $model->photo =$photoName;  
                }
            }
            // $model->updated_by=Auth::user()->id;
            $model->updated_at=Carbon::now()->toDateTimeString();
            $model->save();
           
        // $model=SubplateModel::findOrFail($request->sub_id);
        // $model->scan_by=$request->scan;
        // $model->qc_by=$request->qc;
        // $model->modeldesign_by=$request->modeldesign;
        // $model->status=$request->status;
        // $model->amount=$request->amount;
        // $model->design_by=$request->design_by;
        // $model->updated_at=Carbon::now()->toDateTimeString();
        // $model->save();
        
        $data = SubplateModel::where('id',$request->sub_id)->get();
        $data["samplecount"] = ScanningModel::where('status','pending')->where('worktype','Sample')->count();
        $data["scantotal"] = ScanningModel::where('status','pending')->count();
        $data["designby"] = SubplateModel::select('design_by')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('design_by','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["orderby"] = SubplateModel::select('order_by')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('order_by','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["receivedworkby"] = SubplateModel::select('received_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('received_workby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["receivedqcby"] = SubplateModel::select('received_qcby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('received_qcby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["vmcworkby"] = SubplateModel::select('vmc_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('vmc_workby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["vmcqcby"] = SubplateModel::select('vmc_qcby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('vmc_qcby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["drilltapworkby"] = SubplateModel::select('drilltap_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('drilltap_workby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["finalqcby"] = SubplateModel::select('final_qcby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('final_qcby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        $data["packingworkby"] = SubplateModel::select('packing_workby')
        ->join('scan as s', 's.id', '=', 'subplate.projectid')
        ->where('packing_workby','=', NULL)
        ->where('s.status', 'pending')
        ->count();
        //$data["design_by"] = SubplateModel::where('design_by','')->where('status','pending')->count();
        
      // dd($data["design_by"]);

        // $data["design_by"] =SubplateModel::select('design_by')->join('scan as s', 's.id', '=', 'subplate.projectid')
        // ->where('scan.status','pending')->get()->count();
         print_r(json_encode($data));
            // // Retrieve the values from the request
            // $subId = $request->subid;
            // $columnName = $request->columnname;
            // $value = $request->value;

            // // Perform the necessary actions based on the values
            // // For example, you can update the database with the new value
            // // Replace the following code with your actual logic
            // $subPlate = SubplateModel::findOrFail($subId);
            // $subPlate->$columnName = $value;
            // $subPlate->save();

            // // Return a response indicating the success of the update
            //  return response()->json(['success' => true]);
        }
    }
    public function deletesubplate(Request $request)
    {
        try
        {   
            $model=SubplateModel::where('id',$request->id)->delete();
            return response()->json(['status'=>true,'message' => "plate deleted successfully."], 200);
       } 
       catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       } 
    }
   
}
