<?php

namespace App\Http\Controllers;
use App\Models\CustomerModel;
use App\Models\PrintingModel;
use App\Models\ScanningModel;
use App\Models\SubplateModel;
use App\Models\UserModel;
use App\Models\WorkModel;
use Carbon\Carbon;
use DateTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\DataTables as DataTables;

class WorkController extends Controller
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
        // $data = CustomerModel::latest()->where('usertype','Customer')->get();
        $data = ScanningModel::join('customers', 'scan.cname', '=', 'customers.id')
        ->where('customers.usertype', 'Customer')
        ->where('scan.status','=', 'pending')
        ->groupBy('scan.cname','customername','id')
        ->select('scan.cname','customers.id AS id','customers.customername AS customername') // Select the columns from the "scans" table that you need
        ->get();
    
        $data1 = ScanningModel::latest()->get(); 
        // $data2 = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->where('userid',Auth::user()->id)->get();
        $data2 = WorkModel::leftJoin('users', 'worklog.userid', '=', 'users.id')->select('users.id','users.name')->groupBy('worklog.userid', 'users.id', 'users.name')->get();
               
        // $data2 = UserModel::latest()->get();    
        // $amount = WorkModel::where('userid',Auth::user()->id)->whereDate('rdate', Carbon::today())->get()->sum(function($t){ 
        //     return  $t->work_hr + $t->program_hr + $t->machine_hr + $t->driltap_hr +$t->qc_hr; 
        // });
        $amountInMinutes = WorkModel::where('userid', Auth::user()->id)
        ->whereDate('rdate', Carbon::today())
        ->get()
        ->sum(function($t) {
            $timeParts = explode(':', $t->work_hr);
            $hoursInMinutes = intval($timeParts[0]) * 60;
            $minutes = intval($timeParts[1]);
            return $hoursInMinutes + $minutes;
        });

        $hours = floor($amountInMinutes / 60);
        $minutes = $amountInMinutes % 60;
        $formattedAmount = sprintf('%02d:%02d', $hours, $minutes);

    //  print_r($amount);
        return view('work.index',["data"=>$data,"data1"=>$data1,"amount"=>$formattedAmount,"data2"=>$data2,"currentDateTime"=>$currentDateTime]);
    }
    public function workdata() 
    {
        $currentDateTime = Carbon::now()->format('d/m/Y');
        // $data2 = UserModel::latest()->get(); 
        $data2 = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.customerid', 'customers.id as id', 'customers.customername as name', WorkModel::raw('MAX(worklog.id) as max_id'))->groupBy('worklog.customerid', 'customers.id', 'customers.customername')->get();
        $datauser = WorkModel::leftJoin('users', 'worklog.userid', '=', 'users.id')->select('worklog.userid', 'users.id as id', 'users.name as name', WorkModel::raw('MAX(worklog.id) as max_id'))->groupBy('worklog.userid', 'users.id', 'users.name')->get();
        $datawork=ScanningModel::select('worktype')->groupBy('worktype')->get();
        $dataproject=WorkModel::select('projectid')->groupBy('projectid')->get();
        return view('work.workdata',["data2"=>$data2,"currentDateTime"=>$currentDateTime, "datawork"=>$datawork,"dataproject"=>$dataproject,"datauser"=>$datauser]);
    }
    public function pendingwork()
    {
        $currentDateTime = Carbon::now()->format('d/m/Y');
    //  print_r($amount);
        return view('work.pendingwork',["currentDateTime"=>$currentDateTime]);
    }
    public function indexmobile(Request $request)
    {
        try
        {
            if(Auth::user()->role=="0"){
                if($request->userid!=null && $request->userid!=""){
                    $data = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->where('userid',$request->userid)->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                    $res=array();
                    foreach ($data as $key => $row) {
                     $d="";
                     $w="";
                     if($row->projectid){
                         $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                         // $res='<option value="">Select Project</option>';

                         foreach ($data as $key => $value) {
                             $d=$value->description;
                             $w=$value->worktype;
                         }
                     }
                     else{
                         $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                     
                         foreach ($data as $key => $value) {
                             $d=$value->description;
                             $w=$value->worktype;
                         }
                     }
                     $row->description=$d;
                     $row->worktype=$w;
                     $data11 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                     $subplate="";
                     if($data11->count()>0){
                         foreach ($data11 as $key => $value) {
                             # code...
                             $subplate=$value->platename;
                         }
                         
                     }
                         $row->subplatename=$subplate;
                     $data1 = UserModel::latest()->where("id",$row->userid)->get(); 
                     $username="";
                         if($data1->count()>0){
                             foreach ($data1 as $key => $value) {
                                 # code...
                                 $username=$value->name;
                             }
                             
                         }
                         $row->username=$username;
                         array_push($res,$row);
                    }
                    return response()->json(['status'=>true,'data' => $res], 200);
                }else{
                    $data = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->whereDate('rdate', Carbon::today())->get();
                    $res=array();
                    foreach ($data as $key => $row) {
                     $d="";
                     $w="";
                     if($row->projectid){
                         $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                         // $res='<option value="">Select Project</option>';
                         foreach ($data as $key => $value) {
                             $d=$value->description;
                             $w=$value->worktype;
                         }
                     }
                     else{
                         $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                     
                         foreach ($data as $key => $value) {
                             $d=$value->description;
                             $w=$value->worktype;
                         }
                     }
                     $row->description=$d;
                     $row->worktype=$w;
                     $data11 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                     $subplate="";
                     if($data11->count()>0){
                         foreach ($data11 as $key => $value) {
                             # code...
                             $subplate=$value->platename;
                         }
                         
                     }
                         $row->subplatename=$subplate;
                     $data1 = UserModel::latest()->where("id",$row->userid)->get(); 
                     $username="";
                         if($data1->count()>0){
                             foreach ($data1 as $key => $value) {
                                 # code...
                                 $username=$value->name;
                             }
                             
                         }
                         $row->username=$username;
                         array_push($res,$row);
                    }
                    return response()->json(['status'=>true,'data' => $res], 200);
                }
            }else{
                $data = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->where('userid',Auth::user()->id)->whereDate('rdate', Carbon::today())->get();
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
    public function getselectedWork(Request $request)
    {
        if ($request->ajax()) {
            if (Auth::user()->role == "0" || Auth::user()->role == "1") {
                if (($request->has('customerids') && $request->customerids != "") || ($request->has('worktype') && $request->worktype != "") || ($request->has('projectid') && $request->projectid != "") || ($request->has('userid') && $request->userid != "") || ($request->has('maindate') && $request->maindate != "")) {
                    $query = WorkModel::leftJoin('scan', 'worklog.scan_print_id', '=', 'scan.id')->select('worklog.*', 'scan.projectid','scan.worktype');
                    if ($request->has('customerids') && $request->customerids != "") {
                        $customerIds = explode(',', $request->customerids);
                        $query->whereIn('customerid', $customerIds);
                    }
                    if ($request->has('worktype') && $request->worktype != "") {
                        $worktype = explode(',', $request->worktype);
                        $query->whereIn('scan.worktype', $worktype);
                    }
                    if ($request->has('projectid') && $request->projectid != "") {
                        $projectid = explode(',', $request->projectid);
                        $query->whereIn('scan.projectid', $projectid);
                    }
                    if ($request->has('userid') && $request->userid != "") {
                        $userid = explode(',', $request->userid);
                        $query->whereIn('userid', $userid);
                    }
                    if ($request->has('maindate') && $request->maindate != "") {
                        $maindate = explode(',', $request->maindate);
                        $formattedDates = array_map(function ($maindate) {
                            return Carbon::createFromFormat("d/m/Y", $maindate)->format('Y-m-d');
                        }, $maindate);
                    
                        $query->whereIn('worklog.rdate', $formattedDates);
                    }
                    
                    $data = $query->get();
                } else {
                    $data = WorkModel::get();
                }
            } else {
                $data = WorkModel::where('userid', Auth::user()->id)->get();
            }
            
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
        ->addColumn('rdate',function($row){
            // dd($row->rdate);
            return [
                // 'display' => e(Carbon::createFromFormat("d/m/Y", $row->rdate)->format('Y-m-d')),
                'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                'timestamp' => $row->rdate
             ];
            // return Carbon::parse($row->rdate)->format('d-m-Y');
        })
        ->addColumn('sdate',function($row){
            return [
                'display' => e(Carbon::parse($row->sdate)->format('d-m-Y')),
                'timestamp' => $row->sdate
             ];
            // return Carbon::parse($row->rdate)->format('d-m-Y');
        })
        ->addColumn('edate',function($row){
            return [
                'display' => e(Carbon::parse($row->edate)->format('d-m-Y')),
                'timestamp' => $row->edate
             ];
            // return Carbon::parse($row->rdate)->format('d-m-Y');
        })
        ->addColumn('starttime', function ($row) {
            return @date("h:i A", strtotime($row->starttime));
        })
        ->addColumn('endtime', function ($row) {
            return @date("h:i A", strtotime($row->endtime));
        })
        ->addColumn('work_hr', function ($row) {
            $duration = $row->work_hr;
           
            list($totalHours, $minutes, $seconds) = sscanf($duration, "%d:%d:%d");
            
            // Calculate total minutes
            $totalMinutes = ($totalHours * 60) + $minutes;
            
            // Format total hours and minutes
            $formattedDuration = sprintf("%02d:%02d", $totalMinutes / 60, $totalMinutes % 60);
            
            return $formattedDuration;
        })
        ->addColumn('worktype', function($row){
            $d="";
            if($row->projectid){
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
            if($row->projectid){
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
        ->addColumn('subplateid',function($row){
            $data1 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
            $subplate="";
            if($data1->count()>0){
                foreach ($data1 as $key => $value) {
                    # code...
                    $subplate=$value->platename;
                }
                
            }
            return $subplate;
        })  
        ->addColumn('username',function($row){
            $data1 = UserModel::where("id",$row->userid)->get(); 
            // dd($data1);
            $username="";
            if($data1->count()>0){
                foreach ($data1 as $key => $value) {
                    # code...
                    $username=$value->name;
                }
                
            }
            return $username;
        })
                
        ->addColumn('action', function($row){
            $rdate = Carbon::parse($row->rdate);
            $row->rdate=$rdate->format('d/m/Y');
            $d="";
            $d1="";
            if($row->projectid){
                $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                // $res='<option value="">Select Project</option>';
                foreach ($data as $key => $value) {
                    $d=$value->description;
                    $d1=$value->worktype;
                    
                }
            }
            else{
                $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
            
                foreach ($data as $key => $value) {
                    $d=$value->description;
                    $d1=$value->worktype;
                }
            }
            $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$d1.'\',\''.$d.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm">Edit</a>';

             return $btn;
        }) 
        // ->rawColumns(['action'])
        
        ->make(true);
        }
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {

            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            if(Auth::user()->role=="0" || Auth::user()->role=="1"){
                if($request->userid!=null && $request->userid!=""){
                    $data = WorkModel::where('userid',$request->userid)->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                }
                elseif($request->wdate != null && $request->wdate != "")
                {
                    $data = WorkModel::whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                }
                else{
                    $data = WorkModel::whereDate('rdate', Carbon::today())->get();
                }
            }else{
                $data = WorkModel::where('userid',Auth::user()->id)->whereDate('rdate', Carbon::today())->get();
            }
            return DataTables::of($data)
            ->addIndexColumn()  
            ->addColumn('subplateid',function($row){
                $data1 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                $subplate="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $subplate=$value->platename;
                    }
                    
                }
                return $subplate;
            })
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
            ->addColumn('username',function($row){
                $data1 = UserModel::where("id",$row->userid)->get();
                $username="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $username=$value->name;
                    }
                    
                }
                return $username;
            })
            ->addColumn('rdate',function($row){
                return [
                    'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                    'timestamp' => $row->rdate
                 ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('sdate',function($row){
                return [
                    'display' => e(Carbon::parse($row->sdate)->format('d-m-Y')),
                    'timestamp' => $row->sdate
                 ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('edate',function($row){
                return [
                    'display' => e(Carbon::parse($row->edate)->format('d-m-Y')),
                    'timestamp' => $row->edate
                 ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('starttime', function ($row) {
                return @date("h:i A", strtotime($row->starttime));
            })
            ->addColumn('endtime', function ($row) {
                return @date("h:i A", strtotime($row->endtime));
            })
            ->addColumn('work_hr', function ($row) {
                $duration = $row->work_hr;
               
                list($totalHours, $minutes, $seconds) = sscanf($duration, "%d:%d:%d");
                
                // Calculate total minutes
                $totalMinutes = ($totalHours * 60) + $minutes;
                
                // Format total hours and minutes
                $formattedDuration = sprintf("%02d:%02d", $totalMinutes / 60, $totalMinutes % 60);
                
                return $formattedDuration;
            })
           
            ->addColumn('worktype', function($row){
                $d="";
                if($row->projectid){
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
                if($row->projectid){
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
            ->addColumn('action', function($row){
                $rdate = Carbon::parse($row->rdate);
                $row->rdate=$rdate->format('d/m/Y');
                $sdate = Carbon::parse($row->sdate);
                $row->sdate=$sdate->format('d/m/Y');
                $edate = Carbon::parse($row->edate);
                $row->edate=$edate->format('d/m/Y');
                $row->workdescription=str_replace("\"","<>",$row->workdescription);
                $duration = $row->work_hr;
               
                list($totalHours, $minutes, $seconds) = sscanf($duration, "%d:%d:%d");
                
                // Calculate total minutes
                $totalMinutes = ($totalHours * 60) + $minutes;
                
                // Format total hours and minutes
                $formattedDuration = sprintf("%02d:%02d", $totalMinutes / 60, $totalMinutes % 60);
                
                $row->work_hr = $formattedDuration;
                
                $d="";
                $d1="";
                if($row->projectid){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=str_replace("\"","<>",$value->description);
                        $d1=$value->worktype;
                        
                    }
                }
                else{
                    $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        $d1=$value->worktype;
                    }
                }
                // $row->description=str_replace("\"","<>",$row->description);
                if((Auth::user()->role == 0) ||  (Auth::user()->role == 1)){
                $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$d1.'\',\''.$d.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm">Edit</a>';

                 return $btn;}
            }) 
            ->rawColumns(['action'])
            
            ->make(true);
          //  return $data;                          
        }
    }
    public function gethrData(Request $request)
    {
        if ($request->ajax()) {

            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            if(Auth::user()->role=="0"){
                if($request->userid!=null && $request->userid!=""){
                    // $data = WorkModel::latest()->where('userid',$request->userid)->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                    $amountInMinutes = WorkModel::where('userid', $request->userid)->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get()
                    
                    ->sum(function($t) {
                        $timeParts = explode(':', $t->work_hr);
                        $hoursInMinutes = intval($timeParts[0]) * 60;
                        $minutes = intval($timeParts[1]);
                        return $hoursInMinutes + $minutes;
                    });
            
                $hours = floor($amountInMinutes / 60);
                $minutes = $amountInMinutes % 60;
                $formattedAmount = sprintf('%02d:%02d', $hours, $minutes);

                    // $data = WorkModel::selectRaw('COALESCE(SUM(work_hr + design_hr + program_hr + machine_hr + driltap_hr + qc_hr), 0) as amount')->where('userid',$request->userid)->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                    // $amount = $data[0]->amount;
                    return response()->json([
                        'amount' => $formattedAmount,
                    ]);
                    
                }
                elseif($request->wdate != null && $request->wdate != "")
                {
                    // $data = WorkModel::latest()->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                    $amountInMinutes = WorkModel::whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get()
                    
                    ->sum(function($t) {
                        $timeParts = explode(':', $t->work_hr);
                        $hoursInMinutes = intval($timeParts[0]) * 60;
                        $minutes = intval($timeParts[1]);
                        return $hoursInMinutes + $minutes;
                    });
            
                $hours = floor($amountInMinutes / 60);
                $minutes = $amountInMinutes % 60;
                $formattedAmount = sprintf('%02d:%02d', $hours, $minutes);

                    // $data = WorkModel::selectRaw('COALESCE(SUM(work_hr + design_hr + program_hr + machine_hr + driltap_hr + qc_hr), 0) as amount')->where('userid',$request->userid)->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))->get();
                    // $amount = $data[0]->amount;
                    return response()->json([
                        'amount' => $formattedAmount,
                    ]);
                }
                else{
                    $data = WorkModel::latest()->whereDate('rdate', Carbon::today())->get();
                }
            }   
            return DataTables::of($data)
            ->make(true);
          //  return $data;                          
        }
    }
    public function getWorkmobile(Request $request)
    {
        try{
            if(Auth::user()->role=="0")
            {
               
               // $data = WorkModel::latest()->get();
               $data = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->get();
               //print_r(json_encode($data));
               $res=array();
               foreach ($data as $key => $row) {
                $d="";
                $w="";
                if($row->projectid){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        $w=$value->worktype;
                    }
                }
                else{
                    $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        $w=$value->worktype;
                    }
                }
                $row->description=$d;
                $row->worktype=$w;
                $data11 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                $subplate="";
                if($data11->count()>0){
                    foreach ($data11 as $key => $value) {
                        # code...
                        $subplate=$value->platename;
                    }
                    
                }
                    $row->subplatename=$subplate;
                $data1 = UserModel::latest()->where("id",$row->userid)->get(); 
                $username="";
                    if($data1->count()>0){
                        foreach ($data1 as $key => $value) {
                            # code...
                            $username=$value->name;
                        }
                        
                    }
                    $row->username=$username;
                    array_push($res,$row);
               }
                // $data =WorkModel::select('worklog.*,(selectRaw(customername from customers where customers.id=worklog.customerid))as customername')->get();
                return response()->json(['status'=>true,'data' => $res], 200);
            }
            else
            {
                $res=array();
                $data = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')->select('worklog.*','customers.customername')->where('userid',Auth::user()->id)->get();
                foreach ($data as $key => $row) {
                    $d="";
                    $w="";
                    if($row->projectid){
                        $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                        // $res='<option value="">Select Project</option>';
                        foreach ($data as $key => $value) {
                            $d=$value->description;
                            $w=$value->worktype;
                        }
                    }
                    else{
                        $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                    
                        foreach ($data as $key => $value) {
                            $d=$value->description;
                            $w=$value->worktype;
                        }
                    }
                    $row->description=$d;
                    $row->worktype=$w;
                    $data11 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                    $subplate="";
                    if($data11->count()>0){
                        foreach ($data11 as $key => $value) {
                            # code...
                            $subplate=$value->platename;
                        }
                        
                    }
                        $row->subplatename=$subplate;
                    $data1 = UserModel::latest()->where("id",$row->userid)->get(); 
                    $username="";
                    if($data1->count()>0){
                        foreach ($data1 as $key => $value) {
                            # code...
                            $username=$value->name;
                        }
                        
                    }
                    $row->username=$username;
                    array_push($res,$row);
                   }
                   return response()->json(['status'=>true,'data' => $res], 200);
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
    public function getWork(Request $request)
    {
        if ($request->ajax()) {
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->get();
            if((Auth::user()->role=="0") || (Auth::user()->role=="1"))
            {
                $data = WorkModel::latest()->get();
            }
            else
            {
                $data = WorkModel::latest()->where('userid',Auth::user()->id)->get();
            }
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
            ->addColumn('rdate',function($row){
                return [
                    'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                    'timestamp' => $row->rdate
                 ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('sdate',function($row){
                return [
                    'display' => e(Carbon::parse($row->sdate)->format('d-m-Y')),
                    'timestamp' => $row->sdate
                 ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('edate',function($row){
                return [
                    'display' => e(Carbon::parse($row->edate)->format('d-m-Y')),
                    'timestamp' => $row->edate
                 ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('starttime', function ($row) {
                return @date("h:i A", strtotime($row->starttime));
            })
            ->addColumn('endtime', function ($row) {
                return @date("h:i A", strtotime($row->endtime));
            })
            ->addColumn('work_hr', function ($row) {
                $duration = $row->work_hr;
               
                list($totalHours, $minutes, $seconds) = sscanf($duration, "%d:%d:%d");
                
                // Calculate total minutes
                $totalMinutes = ($totalHours * 60) + $minutes;
                
                // Format total hours and minutes
                $formattedDuration = sprintf("%02d:%02d", $totalMinutes / 60, $totalMinutes % 60);
                
                return $formattedDuration;
            })
            ->addColumn('worktype', function($row){
                $d="";
                if($row->projectid){
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
                if($row->projectid){
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
            ->addColumn('subplateid',function($row){
                $data1 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                $subplate="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $subplate=$value->platename;
                    }
                    
                }
                return $subplate;
            })  
            ->addColumn('username',function($row){
                $data1 = UserModel::where("id",$row->userid)->get(); 
                // dd($data1);
                $username="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $username=$value->name;
                    }
                    
                }
                return $username;
            })
                    
            ->addColumn('action', function($row){
                $rdate = Carbon::parse($row->rdate);
                $row->rdate=$rdate->format('d/m/Y');
                $d="";
                $d1="";
                if($row->projectid){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        $d1=$value->worktype;
                        
                    }
                }
                else{
                    $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        $d1=$value->worktype;
                    }
                }
                $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$d1.'\',\''.$d.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm">Edit</a>';

                 return $btn;
            }) 
            // ->rawColumns(['action'])
            
            ->make(true);
          //  return $data;                          
        }
    }
    public function getPendingworkmobile(Request $request)
    {
        try{
            if($request->wdate!=null){
                $date = Carbon::createFromFormat("d/m/Y", $request->wdate)->format('Y-m-d');

                $data = UserModel::select('users.id', 'users.name','worklog.rdate')
                    ->selectRaw('COALESCE(ROUND(SUM(work_hr), 2), 0) as work_hr')
                    ->selectRaw('COALESCE(ROUND(SUM(design_hr), 2), 0) as design_hr')
                    ->selectRaw('COALESCE(ROUND(SUM(machine_hr), 2), 0) as machine_hr')
                    ->selectRaw('COALESCE(ROUND(SUM(program_hr), 2), 0) as program_hr')
                    ->selectRaw('COALESCE(ROUND(SUM(qc_hr), 2), 0) as qc_hr')
                    ->selectRaw('COALESCE(ROUND(SUM(driltap_hr), 2), 0) as driltap_hr')
                    ->selectRaw('COALESCE(ROUND(SUM(work_hr + design_hr + machine_hr + program_hr + qc_hr + driltap_hr), 0), 0) as total')
                    ->addSelect(WorkModel::raw("'{$date}' as rdate"))
                    ->leftJoin('worklog', function ($join) use ($date) {
                        $join->on('users.id', '=', 'worklog.userid')
                            ->where(WorkModel::raw('DATE(worklog.rdate)'), '=', $date);
                    })
                    ->where('users.status', 1)
                    ->groupBy('users.id', 'users.name','worklog.rdate')
                    ->get();
                return response()->json(['status'=>true,'data' => $data], 200);

            }
            else
            {
                $date = Carbon::today()->format('Y-m-d');

                    $data = UserModel::select('users.id', 'users.name','worklog.rdate')
                        ->selectRaw('COALESCE(ROUND(SUM(work_hr), 2), 0) as work_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(design_hr), 2), 0) as design_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(machine_hr), 2), 0) as machine_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(program_hr), 2), 0) as program_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(qc_hr), 2), 0) as qc_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(driltap_hr), 2), 0) as driltap_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(work_hr + design_hr + machine_hr + program_hr + qc_hr + driltap_hr), 0), 0) as total')
                        ->addSelect(WorkModel::raw("'{$date}' as rdate"))
                        ->leftJoin('worklog', function ($join) use ($date) {
                            $join->on('users.id', '=', 'worklog.userid')
                                ->where(WorkModel::raw('DATE(worklog.rdate)'), '=', $date);
                        })
                        ->where('users.status', 1)
                        ->groupBy('users.id', 'users.name','worklog.rdate')
                        ->get();
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
    public function getPendingwork(Request $request)
    {
        if ($request->ajax()) {
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->get();
            // if(Auth::user()->role=="0")
            // {


                
                if($request->wdate!=null){
                    // $data = WorkModel::join('users', 'users.id', '=', 'worklog.userid')
                    // ->select('users.*','worklog.*', WorkModel::raw('sum(print_hr) as print_hr,sum(rework_hr) as rework_hr,sum(qc_hr) as qc_hr,sum(insp_hr) as insp_hr,sum(scan_hr) as scan_hr,sum(model_hr) as model_hr,sum(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr)as total, userid'))
                    // ->groupBy('worklog.userid')
                    // ->get();
                    
                    
                    // $data = WorkModel::join('users', 'worklog.userid', '=', 'users.id')
                    // ->groupBy(['userid', 'rdate','users.name'])
                    // ->selectRaw('sum(print_hr) as print_hr, sum(rework_hr) as rework_hr, sum(qc_hr) as qc_hr, sum(insp_hr) as insp_hr, sum(scan_hr) as scan_hr, sum(model_hr) as model_hr, sum(print_hr + rework_hr + qc_hr + insp_hr + scan_hr + model_hr) as total, userid, rdate, users.name')
                    // ->whereDate('rdate', Carbon::createFromFormat("d/m/Y", $request->wdate)->format('Y-m-d'))
                    // ->get();
                    $date = Carbon::createFromFormat("d/m/Y", $request->wdate)->format('Y-m-d');

                    $data = UserModel::select('users.id', 'users.name','worklog.rdate')
                        ->selectRaw('COALESCE(ROUND(SUM(work_hr), 2), 0) as work_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(design_hr), 2), 0) as design_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(machine_hr), 2), 0) as machine_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(program_hr), 2), 0) as program_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(qc_hr), 2), 0) as qc_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(driltap_hr), 2), 0) as driltap_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(work_hr + design_hr + machine_hr + program_hr + qc_hr + driltap_hr), 0), 0) as total')
                        ->addSelect(WorkModel::raw("'{$date}' as rdate"))
                        ->leftJoin('worklog', function ($join) use ($date) {
                            $join->on('users.id', '=', 'worklog.userid')
                                ->where(WorkModel::raw('DATE(worklog.rdate)'), '=', $date);
                        })
                        ->where('users.status', 1)
                        ->groupBy('users.id', 'users.name','worklog.rdate')
                        ->get();
                    // $data = UserModel::select('users.id', 'users.name',)
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN print_hr ELSE 0 END), 2), 0) as print_hr', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN rework_hr ELSE 0 END), 2), 0) as rework_hr', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN qc_hr ELSE 0 END), 2), 0) as qc_hr', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN insp_hr ELSE 0 END), 2), 0) as insp_hr', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN scan_hr ELSE 0 END), 2), 0) as scan_hr', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN model_hr ELSE 0 END), 2), 0) as model_hr', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->selectRaw('COALESCE(ROUND(SUM(CASE WHEN worklog.rdate = ? THEN (print_hr + rework_hr + qc_hr + insp_hr + scan_hr + model_hr) ELSE 0 END), 2), 0) as total', [Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d')])
                    // ->leftJoin('worklog', 'users.id', '=', 'worklog.userid')
                    // ->where('users.status', 1)
                    // ->groupBy('users.id', 'users.name',$request->wdate)
                    // ->get();



                    // $data = WorkModel::groupBy(['userid','rdate'])
                    // ->selectRaw('sum(print_hr) as print_hr,sum(rework_hr) as rework_hr,sum(qc_hr) as qc_hr,sum(insp_hr) as insp_hr,sum(scan_hr) as scan_hr,sum(model_hr) as model_hr,sum(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr)as total, userid,rdate')
                    // ->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))
                    // // ->whereDate('rdate', Carbon::today())
                    // ->get();

                    // $data = UserModel::leftJoin('worklog', function($join) use ($request) {
                    //     $join->on('users.id', '=', 'worklog.userid')
                    //         ->where('worklog.rdate', '=', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'));
                    // })
                    // ->select('users.id', 'users.name as username', WorkModel::raw('IFNULL(SUM(worklog.print_hr), 0) AS print_hr, IFNULL(SUM(worklog.rework_hr), 0) AS rework_hr, IFNULL(SUM(worklog.qc_hr), 0) AS qc_hr,IFNULL(SUM(worklog.insp_hr), 0) AS insp_hr,IFNULL(SUM(worklog.scan_hr), 0) AS scan_hr,IFNULL(SUM(worklog.model_hr), 0) AS model_hr,IFNULL(SUM(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr), 0) as total'), WorkModel::raw("COALESCE(worklog.rdate, '$request->wdate') AS rdate"))
                    // ->where('users.status', 1)
                    // ->groupBy('users.id', 'users.name', 'worklog.rdate')
                    // ->get();



                    // $data = UserModel::leftJoin('worklog', function($join) use ($request) {
                    //     $join->on('users.id', '=', 'worklog.userid')
                    //          ->where('worklog.rdate', '=', $request->wdate);
                    // })
                    // ->select('users.id', 'users.name as username', WorkModel::raw('IFNULL(SUM(worklog.print_hr), 0) AS print_hr, IFNULL(SUM(worklog.rework_hr), 0) AS rework_hr, IFNULL(SUM(worklog.qc_hr), 0) AS qc_hr,IFNULL(SUM(worklog.insp_hr), 0) AS insp_hr,IFNULL(SUM(worklog.scan_hr), 0) AS scan_hr,IFNULL(SUM(worklog.model_hr), 0) AS model_hr,IFNULL(SUM(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr), 0) as total'), WorkModel::raw("COALESCE(worklog.rdate, '".$request->wdate."') AS rdate"))
                    // ->where('users.status', 1)
                    // ->groupBy('users.id', 'users.name', 'worklog.rdate')
                    
                    // ->get();

                    // $data = UserModel::select('users.id', 'users.name as username', WorkModel::raw('IFNULL(SUM(worklog.print_hr), 0) AS print_hr, IFNULL(SUM(worklog.rework_hr), 0) AS rework_hr, IFNULL(SUM(worklog.qc_hr), 0) AS qc_hr,IFNULL(SUM(worklog.insp_hr), 0) AS insp_hr,IFNULL(SUM(worklog.scan_hr), 0) AS scan_hr,IFNULL(SUM(worklog.model_hr), 0) AS model_hr,IFNULL(SUM(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr), 0) as total'),WorkModel::raw("COALESCE(worklog.rdate, '".$request->wdate."') AS rdate"))
                    // ->leftJoin('worklog', function($join) use($request) {
                    //     $join->on('users.id', '=', 'worklog.userid')
                    //         ->whereDate('worklog.rdate', Carbon::createFromFormat("d/m/Y", $request->wdate)->format('Y-m-d'));
                    // })
                    // ->where('users.status', 1)
                    // ->groupBy('users.id', 'users.name','worklog.rdate')
                    // ->get();
                }
                else
                {
                    
                    // $data = UserModel::select('users.id', 'users.name')
                    // ->selectRaw('COALESCE(SUM(print_hr), 0) as print_hr')
                    // ->selectRaw('COALESCE(SUM(rework_hr), 0) as rework_hr')
                    // ->selectRaw('COALESCE(SUM(qc_hr), 0) as qc_hr')
                    // ->selectRaw('COALESCE(SUM(insp_hr), 0) as insp_hr')
                    // ->selectRaw('COALESCE(SUM(scan_hr), 0) as scan_hr')
                    // ->selectRaw('COALESCE(SUM(model_hr), 0) as model_hr')
                    // ->selectRaw('COALESCE(SUM(print_hr + rework_hr + qc_hr + insp_hr + scan_hr + model_hr), 0) as total')
                    // ->leftJoin('worklog', 'users.id', '=', 'worklog.userid')
                    // ->where('users.status', 1)
                    // ->groupBy('users.id','users.name')
                    // ->get();

                    $date = Carbon::today()->format('Y-m-d');

                    $data = UserModel::select('users.id', 'users.name','worklog.rdate')
                        ->selectRaw('COALESCE(ROUND(SUM(work_hr), 2), 0) as work_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(design_hr), 2), 0) as design_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(machine_hr), 2), 0) as machine_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(program_hr), 2), 0) as program_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(qc_hr), 2), 0) as qc_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(driltap_hr), 2), 0) as driltap_hr')
                        ->selectRaw('COALESCE(ROUND(SUM(work_hr + design_hr + machine_hr + program_hr + qc_hr + driltap_hr), 0), 0) as total')
                        ->addSelect(WorkModel::raw("'{$date}' as rdate"))
                        ->leftJoin('worklog', function ($join) use ($date) {
                            $join->on('users.id', '=', 'worklog.userid')
                                ->where(WorkModel::raw('DATE(worklog.rdate)'), '=', $date);
                        })
                        ->where('users.status', 1)
                        ->groupBy('users.id', 'users.name','worklog.rdate')
                        ->get();

                    // $data = UserModel::select('users.id', 'users.name')
                    // ->selectRaw('COALESCE(ROUND(SUM(print_hr), 2), 0) as print_hr')
                    // ->selectRaw('COALESCE(ROUND(SUM(rework_hr), 2), 0) as rework_hr')
                    // ->selectRaw('COALESCE(ROUND(SUM(qc_hr), 2), 0) as qc_hr')
                    // ->selectRaw('COALESCE(ROUND(SUM(insp_hr), 2), 0) as insp_hr')
                    // ->selectRaw('COALESCE(ROUND(SUM(scan_hr), 2), 0) as scan_hr')
                    // ->selectRaw('COALESCE(ROUND(SUM(model_hr), 2), 0) as model_hr')
                    // ->selectRaw('COALESCE(ROUND(SUM(print_hr + rework_hr + qc_hr + insp_hr + scan_hr + model_hr), 0), 0) as total')
                    // ->leftJoin('worklog', 'users.id', '=', 'worklog.userid')
                    // // ->where('users.status', 1)
                    // ->groupBy('users.id', 'users.name')
                    // ->get();
                    //  
                }




                // $data = WorkModel::latest()->whereDate('rdate', Carbon::today())->get();3
                    
            // }
            // else
            // {
            //     if(Auth::user()->role !="0")
            // {
            //     if($request->wdate!=null){
            //         // $data = WorkModel::join('users', 'users.id', '=', 'worklog.userid')
            //         // ->select('users.*','worklog.*', WorkModel::raw('sum(print_hr) as print_hr,sum(rework_hr) as rework_hr,sum(qc_hr) as qc_hr,sum(insp_hr) as insp_hr,sum(scan_hr) as scan_hr,sum(model_hr) as model_hr,sum(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr)as total, userid'))
            //         // ->groupBy('worklog.userid')
            //         // ->get();
                    
            //         $data = WorkModel::groupBy(['userid','rdate'])
            //         ->selectRaw('sum(print_hr) as print_hr,sum(rework_hr) as rework_hr,sum(qc_hr) as qc_hr,sum(insp_hr) as insp_hr,sum(scan_hr) as scan_hr,sum(model_hr) as model_hr,sum(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr)as total, userid,rdate')
            //         ->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))
            //         ->where('userid',Auth::user()->id)
            //         // ->whereDate('rdate', Carbon::today())
            //         ->get();
            //     }
            //     else
            //     {
            //         $data = WorkModel::groupBy(['userid','rdate'])
            //         ->selectRaw('sum(print_hr) as print_hr,sum(rework_hr) as rework_hr,sum(qc_hr) as qc_hr,sum(insp_hr) as insp_hr,sum(scan_hr) as scan_hr,sum(model_hr) as model_hr,sum(print_hr+rework_hr+qc_hr+insp_hr+scan_hr+model_hr)as total, userid,rdate')
            //         //->whereDate('rdate', Carbon::createFromFormat("d/m/Y",$request->wdate)->format('Y-m-d'))
            //         ->whereDate('rdate', Carbon::today())
            //         ->where('userid',Auth::user()->id)
            //         ->get();
            //     }
            //     // $data = WorkModel::latest()->whereDate('rdate', Carbon::today())->get();3
                    
            // }
            // }
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->addColumn('customerid',function($row){
            //     $data1 = CustomerModel::latest()->where("id",$row->customerid)->get();
            //     $cname="";
            //     if($data1->count()>0){
            //         foreach ($data1 as $key => $value) {
            //             # code...
            //             $cname=$value->customername;
            //         }
                    
            //     }
            //     return $cname;
            // })
            ->addColumn('rdate',function($row){
            //dd($row->rdate);
                return [
                    'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                    'timestamp' => $row->rdate
                 ];
                // return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            // ->addColumn('worktype', function($row){
            //     $d="";
            //     if(str_starts_with($row->projectid,"S")){
            //         $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
            //         // $res='<option value="">Select Project</option>';
            //         foreach ($data as $key => $value) {
            //             $d=$value->worktype;
                        
            //         }
            //     }
            //     else{
            //         $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
            //         foreach ($data as $key => $value) {
            //             $d=$value->worktype;
            //         }
            //     }
                
               

            //      return $d;
            // }) 
            // ->addColumn('description', function($row){
            //     $d="";
            //     if(str_starts_with($row->projectid,"S")){
            //         $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
            //         // $res='<option value="">Select Project</option>';
            //         foreach ($data as $key => $value) {
            //             $d=$value->description;
                        
            //         }
            //     }
            //     else{
            //         $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
            //         foreach ($data as $key => $value) {
            //             $d=$value->description;
            //         }
            //     }
            //      return $d;
            // })     
            // ->addColumn('username',function($row){
            //     $data1 = UserModel::latest()->where("id",$row->userid)->get(); 
            //     $username="";
            //     if($data1->count()>0){
            //         foreach ($data1 as $key => $value) {
            //             # code...
            //             $username=$value->name;
            //         }
                    
            //     }
            //     return $username;
            // })        
            // ->addColumn('action', function($row){
            //     $rdate = Carbon::parse($row->rdate);
            //     $row->rdate=$rdate->format('d/m/Y');
            //     $d="";
            //     $d1="";
            //     if(str_starts_with($row->projectid,"S")){
            //         $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
            //         // $res='<option value="">Select Project</option>';
            //         foreach ($data as $key => $value) {
            //             $d=$value->description;
            //             $d1=$value->worktype;
                        
            //         }
            //     }
            //     else{
            //         $data=PrintingModel::where("projectid",$row->projectid)->where("cname",$row->customerid)->get();
                
            //         foreach ($data as $key => $value) {
            //             $d=$value->description;
            //             $d1=$value->worktype;
            //         }
            //     }
            //     $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$d1.'\',\''.$d.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm">Edit</a>';

            //      return $btn;
            // }) 
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
    public function addwork(Request $request)
    {
        try
        {
            if($request->id!=""){
                $model=WorkModel::findOrFail($request->id);
                // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
                $model->scan_print_id=$request->scan_print_id;
                $model->subplateid=$request->subplateid;
                $model->customerid=$request->cname;
                $model->projectid=$request->projectid;
                $model->starttime = date('H:i:s', strtotime($request->starttime));
                $model->endtime = date('H:i:s', strtotime($request->endtime));
                $model->work_hr=($request->work_hr==Null || $request->work_hr=="")?0:$request->work_hr;
                $model->design_hr=($request->design_hr==Null || $request->design_hr=="")?0:$request->design_hr;
                $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
                $model->program_hr=($request->program_hr==Null || $request->program_hr=="")?0:$request->program_hr;
                $model->machine_hr=($request->machine_hr==Null || $request->machine_hr=="")?0:$request->machine_hr;
                $model->driltap_hr=($request->driltap_hr==Null || $request->driltap_hr=="")?0:$request->driltap_hr;
                $model->userid=Auth::user()->id;
                $model->save();
                return response()->json(['status'=>true,'message'=>"Data updated successfully"], 200);
            }else{
            $model=new WorkModel();
            $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
            
            $model->subplateid=$request->subplateid;
            $model->scan_print_id=$request->scan_print_id;
            $model->customerid=$request->cname;
            $model->projectid=$request->projectid;
            $model->starttime = date('H:i:s', strtotime($request->starttime));
            $model->endtime = date('H:i:s', strtotime($request->endtime));
            $model->work_hr=($request->work_hr==Null || $request->work_hr=="")?0:$request->work_hr;
                $model->design_hr=($request->design_hr==Null || $request->design_hr=="")?0:$request->design_hr;
                $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
                $model->program_hr=($request->program_hr==Null || $request->program_hr=="")?0:$request->program_hr;
                $model->machine_hr=($request->machine_hr==Null || $request->machine_hr=="")?0:$request->machine_hr;
                $model->driltap_hr=($request->driltap_hr==Null || $request->driltap_hr=="")?0:$request->driltap_hr;
            $model->userid=Auth::user()->id;
            $model->save();
            return response()->json(['status'=>true,'message'=>"Data inserted successfully "], 200);
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
    public function store(Request $request)
    {
        //
        if($request->id!=""){
            $model=WorkModel::findOrFail($request->id);
            if(Auth::user()->role==0){
            $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
            }
            $model->scan_print_id=$request->scan_print_id;
            $model->customerid=$request->cname;
            $model->subplateid=$request->subplateid;
            $model->projectid=$request->projectid;
            
            $model->sdate=Carbon::createFromFormat('d/m/Y', $request->sdate)->format('Y-m-d');
            $model->edate=Carbon::createFromFormat('d/m/Y', $request->edate)->format('Y-m-d');
            $model->starttime = date('H:i:s', strtotime($request->starttime));
            $model->endtime = date('H:i:s', strtotime($request->endtime));
            
            $model->workdescription=$request->workdescription;
            $model->work_hr=($request->work_hr==Null || $request->work_hr=="")?0:$request->work_hr;
                // $model->design_hr=($request->design_hr==Null || $request->design_hr=="")?0:$request->design_hr;
                // $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
                // $model->program_hr=($request->program_hr==Null || $request->program_hr=="")?0:$request->program_hr;
                // $model->machine_hr=($request->machine_hr==Null || $request->machine_hr=="")?0:$request->machine_hr;
                // $model->driltap_hr=($request->driltap_hr==Null || $request->driltap_hr=="")?0:$request->driltap_hr;
            // $model->userid=Auth::user()->id;
            $model->save();
        }else{
        $model=new WorkModel();
        $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');
        $model->sdate=Carbon::createFromFormat('d/m/Y', $request->sdate)->format('Y-m-d');
        $model->edate=Carbon::createFromFormat('d/m/Y', $request->edate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
        $model->scan_print_id=$request->scan_print_id;
        $model->customerid=$request->cname;
        $model->subplateid=$request->subplateid;
        $model->projectid=$request->projectid;
        $model->workdescription=$request->workdescription;
        $model->starttime = date('H:i:s', strtotime($request->starttime));
        $model->endtime = date('H:i:s', strtotime($request->endtime));
        $model->work_hr=($request->work_hr==Null || $request->work_hr=="")?0:$request->work_hr;
                // $model->design_hr=($request->design_hr==Null || $request->design_hr=="")?0:$request->design_hr;
                // $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
                // $model->program_hr=($request->program_hr==Null || $request->program_hr=="")?0:$request->program_hr;
                // $model->machine_hr=($request->machine_hr==Null || $request->machine_hr=="")?0:$request->machine_hr;
                // $model->driltap_hr=($request->driltap_hr==Null || $request->driltap_hr=="")?0:$request->driltap_hr;
        $model->userid=Auth::user()->id;
        $model->save();
        }
        return redirect(route('work.index'));
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
    }
}
