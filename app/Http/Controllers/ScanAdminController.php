<?php

namespace App\Http\Controllers;

use App\Models\ScanningModel;
use App\Models\UserModel;
use App\Models\CustomerModel;
use App\Models\WorkModel;
use App\Models\PrintingModel;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\Facades\DataTables;

class ScanAdminController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $newDateTime = Carbon::now()->addDay(2)->format('d/m/Y');
        $currentDateTime1 = Carbon::now()->format('d/m/Y');
        $newDateTime1 = Carbon::now()->addDay(2)->format('d/m/Y');
        $data = CustomerModel::latest()->get();
        $scantotal = ScanningModel::where('status','pending')->count();
        $scanby = ScanningModel::where('scan_by',0)->where('status','pending')->count();
        $qcby = ScanningModel::where('qc_by',0)->where('status','pending')->count();
        $designby = ScanningModel::where('modeldesign_by',0)->where('status','pending')->count();
        $userdata = UserModel::select('id','initials','status')->where('status','1')->get();
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
        return view('scanadmin.index',compact('currentDateTime1', 'newDateTime1', 'currentDateTime', 'newDateTime', 'data', 'scantotal', 'scanby', 'qcby', 'designby','customerinitials','userdata'));
    }
    public function indexmobile(Request $request)
    {
        try
        {
            if(Auth::user()->role=="0")
            {
                //->orderBy('updated_at', 'desc')
                // if(request()->order[0]["column"]=="11"){
                //     $data = ScanningModel::where("status","registered")->orderBy('payment', request()->order[0]["dir"])->get();
                    
                // }else{
                    $data = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')->select('scan.*','customers.customername')->where("status","registered")->get();
                // } 
                return response()->json(['status'=>true,'data' => $data], 200);
            }
            else
            {
                // ->orderBy('updated_at', 'desc')
                $data = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')->select('scan.*','customers.customername')->where("status","registered")->where('created_at','>=',Carbon::now()->subdays(60))->get();
                return response()->json(['status'=>true,'data' => $data], 200);
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
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ScanningModel::latest()->where("status","pending")->get();
            $start = $request->input('start', 0); // Get the start index of the pagination
            $length = $request->input('length', 100); // Get the length of data to be fetched

            $query = ScanningModel::where("worktype","<>","Sample")->where("status","registered")->with('subplates')->orderBy('rdate','DESC');
            $recordsTotal = $query->count(); // Total count of records
            $recordsFiltered = $recordsTotal = $query->count();

            $data = $query->offset($start)
                ->skip($start)
                ->take($length)
                ->limit($length);
                
            return DataTables::of($data)
            ->addIndexColumn()
            ->setTotalRecords($recordsTotal) // Set the total count of records
            ->setFilteredRecords($recordsFiltered) // Set the total count of filtered records
            ->addColumn('dispatchdate',function($row){
                return [
                    'display' => Carbon::parse($row->dispatchdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->dispatchdate)->timestamp,
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
            ->addColumn('mail_done', function($row){

                   $btn = '<input class="form-check-input" type="checkbox" id="formCheckcolor1" onchange="return changestatus(\''.$row->id.'\');">';

                    return $btn;
            })
            ->addColumn('note', function($row){

                $btn = '<a href="javascript:View(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')"class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" title="View Plates"><i class="fa fa-eye"></i><a>';
                 return $btn;
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
            // ->addColumn("sm_hr",function($row){

            //     $data = WorkModel::join('users as S2', 'worklog.userid', '=', 'S2.id')
            //     ->select(WorkModel::raw('SUM(worklog.design_hr + worklog.program_hr + worklog.machine_hr + worklog.driltap_hr + worklog.qc_hr) as total_hours'), 'worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
            //     ->where('worklog.scan_print_id', $row->id)
            //     ->where('S2.usersubtype', 'Skilled MP')
            //     ->where('S2.usertype', 'Manager')
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
        //     ->addColumn("m_hr",function($row){

        //         $data = WorkModel::join('users as S2', 'worklog.userid', '=', 'S2.id')
        //         ->select(WorkModel::raw('SUM(worklog.work_hr) as total_hours'), 'worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
        //         ->where('worklog.scan_print_id', $row->id)
        //         ->where('S2.usersubtype', 'Machine')
        //         ->where('S2.usertype', 'User')
        //         ->groupBy('worklog.scan_print_id', 'worklog.userid', 'S2.usersubtype','S2.usertype')
        //         ->get();
        //       //$data = WorkModel::where('scan_print_id',$row->id)->get();
        //        // dd($data);
        //        $scanhr=0;
        //        foreach($data as $val){
        //            //$scanhr+=$val->design_hr+$val->program_hr+$val->machine_hr+$val->driltap_hr+$val->qc_hr;
        //            $scanhr+=$val->total_hours;
        //        }
        //        return $scanhr;
        //    })
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
            $dispatchdate = Carbon::parse($row->dispatchdate);
            $row->dispatchdate=$dispatchdate->format('d/m/Y');
            // $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;margin-right: 2px;" href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\')">Edit</a>';
                // $btn .= '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:View(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" >View</a>';
                // $btn .= '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:void(0)" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" projectid="'.$row->projectid.'" onclick="openModal(`'.$row->projectid.'`,`'.$row->id.'`,`'.count($row->subplates).'`)">Add Plate</a>';
                //  return $btn;
         })
         ->setRowId(function($row){

             return "scan_".$row->id;
           })
            ->rawColumns(['mail_done','note','scan_by','qc_by','modeldesign_by','action','amount','mwork','vwork','dwork','pwork','fwork','dswork','mowork'])
            
            ->make(true);
          //  return $data;                          
        }
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
    public function getWorkmobile(Request $request)
    {
        try
        {
            $data = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->where('scan_print_id',$request->id)->where('projectid','like', 'S%')->get();
            return response()->json(['status'=>false,'data' => $data], 200);
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
    public function getWork(Request $request)
    {
        if ($request->ajax()) {
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            $data = WorkModel::latest()->where('scan_print_id',$request->id)->where('projectid','like', 'S%')->get();
            return DataTables::of($data)
            ->addIndexColumn()  
            ->addColumn('customerid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->customerid)->get();
                $cname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $cname=$value->customername;
                    }
                    
                }
                return $cname;
            })
            ->addColumn('userid',function($row){
                $data1 = UserModel::latest()->where("id",$row->userid)->get();
                $uname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $uname=$value->name;
                    }
                    
                }
                return $uname;
            })
            ->addColumn('rdate',function($row){
                return [
                    'display' => Carbon::parse($row->rdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->rdate)->timestamp,
                ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('worktype', function($row){
                $d="";
                if(str_starts_with($row->projectid,"S")){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=$value->worktype;
                        
                    }
                }
                else{
                    $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
                    foreach ($data as $key => $value) {
                        $d=$value->worktype;
                    }
                }
                
               

                 return $d;
            }) 
            ->addColumn('description', function($row){
                $d="";
                if(str_starts_with($row->projectid,"S")){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        
                    }
                }
                else{
                    $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                    }
                }
                 return $d;
            })             
           
            // ->rawColumns(['action'])
            
            ->make(true);
          //  return $data;                          
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
    public function store(Request $request)
    {
        //
        dd($request);
    }
    public function updatestatuspayment(Request $request){
        $model=ScanningModel::findOrFail($request->id);  
        $model->status=$request->status;
        $model->payment=$request->checkres;
        $model->updated_by=Auth::user()->id;
        $model->updated_at=Carbon::now()->toDateTimeString();
        $model->save();
     }
     public function updatestatuspaymentmobilescan(Request $request){
        try{
            $model=ScanningModel::findOrFail($request->id);  
            $model->status='registered';
            $model->payment=$request->checkres;
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
    public function updateamount(Request $request){
        // dd($request);
         $model=ScanningModel::findOrFail($request->id);
         $model->amount=$request->amount;
         $model->updated_by=Auth::user()->role;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
     }
        public function updateamountmobilescan(Request $request){
        // dd($request);
        try
        {
            $model=ScanningModel::findOrFail($request->id);
            $model->amount=$request->amount;
            $model->updated_by=Auth::user()->role;
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
    public function updatestatusscan(Request $request)
    {
        // dd($request);
         $model=ScanningModel::findOrFail($request->id);
         if($request->field=="scan_by"){
            $model->scan_by=$request->value;
        }else if($request->field=="modeldesign_by"){
            $model->modeldesign_by=$request->value;
       }else if($request->field=="qc_by"){
            $model->qc_by=$request->value;  
        }
         $model->updated_by=Auth::user()->id;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
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
    public function updatestatus(Request $request){
        // dd($request);
         $model=ScanningModel::findOrFail($request->id);  
         $model->status=$request->status;
         $model->mail_done=0;
         $model->updated_by=Auth::user()->id;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
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
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
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
        return redirect(route('scanadmin.index'));
    }
    public function deletescandata(Request $request)
    {
        try
        {   
            $model=ScanningModel::where("id", $request->id)->update(["status" => "completed"]);
            return response()->json(['status'=>true,'message' => "Data deleted successfully."], 200);
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
