<?php

namespace App\Http\Controllers;
use App\Models\CustomerModel;
use App\Models\PrintingModel;
use App\Models\ScanningModel;
use App\Models\UserModel;
use App\Models\ExpenseModel;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\DataTables as DataTables;


class ExpenseController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        //  
    //  print_r($amount);
    $now = Carbon::now();
        $resultt = $now->year;
        $resultt1 = Carbon::now()->format('m');
        if($now<Carbon::parse($resultt."-".$resultt1."-01")){
            $startDate=($resultt-1)."-".$resultt1."-01";
            $endDate=($resultt)."-".$resultt1."-31";
        }else{
            $startDate=($resultt)."-".$resultt1."-01";
            $endDate=($resultt+1)."-".$resultt1."-31";
        }
        $data = CustomerModel::latest()->where('usertype','Other')->get();
        $totalcredit = ExpenseModel::where('payment_type', 'Credit')->sum('amount');
        $totaldebit = ExpenseModel::where('payment_type', 'Debit')->sum('amount');
        $outstanding = ExpenseModel::where('payment_type', 'Outstanding')->sum('amount');
        $balance = $outstanding + $totalcredit - $totaldebit;
        return view('expense.index',["data"=>$data,"startDate"=>$now<Carbon::parse($resultt."-".$resultt1."-01")?($resultt-1)."-".$resultt1:$resultt."-".$resultt1,"endDate"=>$now<Carbon::parse($resultt."-".$resultt1."-01")?($resultt)."-".$resultt1:($resultt+1)."-".$resultt1,"totalcredit"=>$totalcredit,"totaldebit"=>$totaldebit,"balance"=>$balance]);
        // return view('expense.index',["data"=>$data,"data1"=>$data1,"amount"=>$amount,"data2"=>$data2,"currentDateTime"=>$currentDateTime]);
    }
    public function indexmobile(Request $request)
    {
        try
        {
                $startDate=$request->startdate."-01";
                //  dd($startDate);
                $endDate=Carbon::parse($startDate)->endOfMonth()->toDateString();
                // dd($endDate);
               // $now = Carbon::now();
              //  $resultt = $now->year;
                // if($now<Carbon::parse($resultt."-04-01")){
                //     $startDate=($resultt-1)."-04-01";
                //     $endDate=($resultt)."-03-31";
                // }else{
                //     $startDate=($resultt)."-04-01";
                //     $endDate=($resultt+1)."-03-31";
                // }
                // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
                if(Auth::user()->role=="0" || Auth::user()->role=="1"){
                    // foreach (CarbonPeriod::create($startDate, '1 month', $endDate) as $month) {
                        if($startDate <> "")
                        {
                            
                            $data = ExpenseModel::leftJoin('customers', 'expense.customerid', '=', 'customers.id')->select('expense.*','customers.customername')->whereBetween('rdate', [$startDate, $endDate])->get();
       
                            return response()->json(['status'=>true,'data' => $data], 200);
                            
                        }
                        else{
                            $data = ExpenseModel::leftJoin('customers', 'expense.customerid', '=', 'customers.id')->select('expense.*','customers.customername')->where('rdate', [$startDate, $endDate])->get();
                            return response()->json(['status'=>true,'data' => $data], 200);
                        }       
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
            $startDate=$request->startdate."-01";
            // \ dd($startDate);
            $endDate=Carbon::parse($startDate)->endOfMonth()->toDateString();
            // dd($endDate);
           // $now = Carbon::now();
          //  $resultt = $now->year;
            // if($now<Carbon::parse($resultt."-04-01")){
            //     $startDate=($resultt-1)."-04-01";
            //     $endDate=($resultt)."-03-31";
            // }else{
            //     $startDate=($resultt)."-04-01";
            //     $endDate=($resultt+1)."-03-31";
            // }
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            if(Auth::user()->role=="0" || Auth::user()->role=="1"){
                // foreach (CarbonPeriod::create($startDate, '1 month', $endDate) as $month) {
                    if($startDate <> "")
                    {
                        $data = ExpenseModel::whereBetween('rdate', [$startDate, $endDate])->get();
                        
                    }
                    else{
                        $data = ExpenseModel::where('rdate', [$startDate, $endDate])->get();
                    }
                    // whereRaw('MONTH(created_at) = ? and YEAR(created_at)=?',[$month->format('m'),$month->format('Y')])->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
                // }        
                    // $data = ExpenseModel::latest()->get();
              
            }
           // dd($data);
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
            // ->addColumn('credit',function($row){
            //   //  $data1 = ExpenseModel::latest()->where("payment_type",'Credit')->get(); 
            //     $credit="";
            //     // if($data1->count()>0){
            //     //     foreach ($data1 as $key => $value) {
            //     //         # code...
            //     //         $credit=$value->amount;
            //     //     }
                    
            //     // }
            //     // else{
            //     //     $credit=0;
            //     // }
            //     if($row->payment_type=="Credit"){
            //         $credit=$row->amount;
            //     }else{
            //         $credit=0;
            //     }
            //     return $credit;
            // })
            ->addColumn('credit', function ($row) {
                $credit = ($row->payment_type == "Credit") ? $row->amount : 0;
                return number_format($credit, 0, '.', ','); // Formats the number with 2 decimal places and commas
            })
            ->addColumn('debit', function ($row) {
                $debit = ($row->payment_type !== "Credit") ? $row->amount : 0;
                return number_format($debit, 0, '.', ','); // Formats the number with 2 decimal places and commas
            })
            
            // ->addColumn('debit',function($row){
            //     $credit="";
            //     if($row->payment_type!="Credit"){
            //         $credit=$row->amount;
            //     }else{
            //         $credit=0;
            //     }
            //     return $credit;
              //  return $debit;
            // })
            ->addColumn('rdate',function($row){
                return [
                    'display' => e(Carbon::parse($row->rdate)->format('d-m-Y')),
                    'timestamp' => $row->rdate
                 ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            }) 
            ->addColumn('action', function($row){
                $rdate = Carbon::parse($row->rdate);
                $row->rdate=$rdate->format('d/m/Y');
                $row->description=str_replace("\"","<>",$row->description);
                $btn = '<a href="javascript:Edit(' . htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8') . ')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style=" padding-right: 10px;padding-left: 10px;!important">Edit</a>';
                $btn .= '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm" style="padding-right: 10px;padding-left: 10px;!important">Delete</a>';
                  
                 return $btn;
            }) 
            ->rawColumns(['action','credit','debit'])
            
            ->make(true);
          //  return $data;                          
        }
    }
    public function getcountDatamobile(Request $request){

        try
        {
            $startDate=$request->startdate."-01";
        // \ dd($startDate);
        $endDate=Carbon::parse($startDate)->endOfMonth()->toDateString();
        // dd($endDate);
       // $now = Carbon::now();
      //  $resultt = $now->year;
        // if($now<Carbon::parse($resultt."-04-01")){
        //     $startDate=($resultt-1)."-04-01";
        //     $endDate=($resultt)."-03-31";
        // }else{
        //     $startDate=($resultt)."-04-01";
        //     $endDate=($resultt+1)."-03-31";
        // }
        // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
        if(Auth::user()->role=="0" || Auth::user()->role=="1"){
            // foreach (CarbonPeriod::create($startDate, '1 month', $endDate) as $month) {
                if($startDate <> "")
                {
                    // $data = ExpenseModel::whereBetween('rdate', [$startDate, $endDate])->get();
                    $query = ExpenseModel::selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Credit" THEN amount ELSE 0 END),0) as totalcredit')
                        ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Debit" THEN amount ELSE 0 END),0) as totaldebit')
                        ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Credit"  AND amountby = "Accountant" THEN amount ELSE 0 END),0) as accountantcredit')
                        ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Debit"  AND amountby = "Accountant" THEN amount ELSE 0 END),0) as accountantdebit')
                        ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Credit"  AND amountby = "Bank" THEN amount ELSE 0 END),0) as bankcredit')
                        ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Debit"  AND amountby = "Bank" THEN amount ELSE 0 END),0) as bankdebit')
                        ->whereBetween('rdate', [$startDate, $endDate]);
    
                    $data = $query->get();
    
                    $totalcredit = $data[0]->totalcredit;
                    $totaldebit = $data[0]->totaldebit;
                    $accountantcredit = $data[0]->accountantcredit;
                    $accountantdebit = $data[0]->accountantdebit;
                    $bankcredit = $data[0]->bankcredit;
                    $bankdebit = $data[0]->bankdebit;

                    return response()->json([
                        'totalcredit' => $totalcredit,
                        'totaldebit' => $totaldebit,
                        'accountantcredit'=> $accountantcredit,
                        'accountantdebit' => $accountantdebit,
                        'bankcredit' => $bankcredit,
                        'bankdebit' => $bankdebit,
                    ]);
                }
                else{
                    $data = ExpenseModel::where('rdate', [$startDate, $endDate])->get();
                    return response()->json(['status'=>true,'data' => $data], 200);
                }
                // whereRaw('MONTH(created_at) = ? and YEAR(created_at)=?',[$month->format('m'),$month->format('Y')])->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
            // }        
                // $data = ExpenseModel::latest()->get();
          
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
    public function getcountData(Request $request)
    {
        if ($request->ajax()) {
            $startDate=$request->startdate."-01";
            // \ dd($startDate);
            $endDate=Carbon::parse($startDate)->endOfMonth()->toDateString();
            // dd($endDate);
           // $now = Carbon::now();
          //  $resultt = $now->year;
            // if($now<Carbon::parse($resultt."-04-01")){
            //     $startDate=($resultt-1)."-04-01";
            //     $endDate=($resultt)."-03-31";
            // }else{
            //     $startDate=($resultt)."-04-01";
            //     $endDate=($resultt+1)."-03-31";
            // }
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            if(Auth::user()->role=="0" || Auth::user()->role=="1"){
                // foreach (CarbonPeriod::create($startDate, '1 month', $endDate) as $month) {
                    if($startDate <> "")
                    {
                        // $data = ExpenseModel::whereBetween('rdate', [$startDate, $endDate])->get();
                        $query = ExpenseModel::selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Credit" THEN amount ELSE 0 END),0) as totalcredit')
                            ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Debit" THEN amount ELSE 0 END),0) as totaldebit')
                            ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Credit"  AND amountby = "Accountant" THEN amount ELSE 0 END),0) as accountantcredit')
                            ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Debit"  AND amountby = "Accountant" THEN amount ELSE 0 END),0) as accountantdebit')
                            ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Credit"  AND amountby = "Bank" THEN amount ELSE 0 END),0) as bankcredit')
                            ->selectRaw('COALESCE(SUM(CASE WHEN payment_type = "Debit"  AND amountby = "Bank" THEN amount ELSE 0 END),0) as bankdebit')
                            ->whereBetween('rdate', [$startDate, $endDate]);
        
                        $data = $query->get();
        
                        $totalcredit = $data[0]->totalcredit;
                        $totaldebit = $data[0]->totaldebit;
                        $accountantcredit = $data[0]->accountantcredit;
                        $accountantdebit = $data[0]->accountantdebit;
                        $bankcredit = $data[0]->bankcredit;
                        $bankdebit = $data[0]->bankdebit;

                        return response()->json([
                            'totalcredit' => $totalcredit,
                            'totaldebit' => $totaldebit,
                            'accountantcredit'=> $accountantcredit,
                            'accountantdebit' => $accountantdebit,
                            'bankcredit' => $bankcredit,
                            'bankdebit' => $bankdebit,
                        ]);
                    }
                    else{
                        $data = ExpenseModel::where('rdate', [$startDate, $endDate])->get();
                    }
                    // whereRaw('MONTH(created_at) = ? and YEAR(created_at)=?',[$month->format('m'),$month->format('Y')])->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
                // }        
                    // $data = ExpenseModel::latest()->get();
              
            }
           // dd($data);
            return DataTables::of($data)
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
    public function addexpense(Request $request)
    {
        try
        {

            if($request->id!=""){
                $model=ExpenseModel::findOrFail($request->id);
                // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
                // $model->scan_print_id=$request->scan_print_id;
                $model->customerid=$request->cname;
                $model->description=$request->description;
                // $model->projectid=$request->projectid;
                $model->payment_type=$request->payment_type;
                $model->payment_mode=$request->payment_mode;
                // $model->amountby=$request->amountby;
                $model->amount=$request->amount;
                // $model->print_hr=($request->print_hr==Null || $request->print_hr=="")?0:$request->print_hr;
                // $model->rework_hr=($request->rework_hr==Null || $request->rework_hr=="")?0:$request->rework_hr;
                // $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
                // $model->insp_hr=($request->insp_hr==Null || $request->insp_hr=="")?0:$request->insp_hr;
                // $model->scan_hr=($request->scan_hr==Null || $request->scan_hr=="")?0:$request->scan_hr;
                // $model->model_hr=($request->model_hr==Null || $request->model_hr=="")?0:$request->model_hr;
                // $model->userid=Auth::user()->id;
                $model->save();
                return response()->json(['status'=>true,'message'=>"Data updated successfully"], 200);
            }else{
                $model=new ExpenseModel();
                $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
                // $model->scan_print_id=$request->scan_print_id;
                $model->customerid=$request->cname;
                $model->description=$request->description;
                // $model->projectid=$request->projectid;
                $model->payment_type=$request->payment_type;
                $model->payment_mode=$request->payment_mode;
                // $model->amountby=$request->amountby;
                $model->amount=$request->amount;
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
            $model=ExpenseModel::findOrFail($request->id);
            // $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
            // $model->scan_print_id=$request->scan_print_id;
            $model->customerid=$request->cname;
            $model->description=$request->description;
            // $model->projectid=$request->projectid;
            $model->payment_type=$request->payment_type;
            $model->payment_mode=$request->payment_mode;
            // $model->amountby=$request->amountby;
            $model->amount=$request->amount;
            // $model->print_hr=($request->print_hr==Null || $request->print_hr=="")?0:$request->print_hr;
            // $model->rework_hr=($request->rework_hr==Null || $request->rework_hr=="")?0:$request->rework_hr;
            // $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
            // $model->insp_hr=($request->insp_hr==Null || $request->insp_hr=="")?0:$request->insp_hr;
            // $model->scan_hr=($request->scan_hr==Null || $request->scan_hr=="")?0:$request->scan_hr;
            // $model->model_hr=($request->model_hr==Null || $request->model_hr=="")?0:$request->model_hr;
            // $model->userid=Auth::user()->id;
            $model->save();
        }else{
        $model=new ExpenseModel();
        $model->rdate=Carbon::createFromFormat('d/m/Y', $request->rdate)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
        // $model->scan_print_id=$request->scan_print_id;
        $model->customerid=$request->cname;
        $model->description=$request->description;
        // $model->projectid=$request->projectid;
        $model->payment_type=$request->payment_type;
        $model->payment_mode=$request->payment_mode;
        // $model->amountby=$request->amountby;
        $model->amount=$request->amount;
        // $model->print_hr=($request->print_hr==Null || $request->print_hr=="")?0:$request->print_hr;
        // $model->rework_hr=($request->rework_hr==Null || $request->rework_hr=="")?0:$request->rework_hr;
        // $model->qc_hr=($request->qc_hr==Null || $request->qc_hr=="")?0:$request->qc_hr;
        // $model->insp_hr=($request->insp_hr==Null || $request->insp_hr=="")?0:$request->insp_hr;
        // $model->scan_hr=($request->scan_hr==Null || $request->scan_hr=="")?0:$request->scan_hr;
        // $model->model_hr=($request->model_hr==Null || $request->model_hr=="")?0:$request->model_hr;
        // $model->userid=Auth::user()->id;
        $model->save();
        }
        return redirect(route('expense.index'));
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
        $model=ExpenseModel::where('id',$id)->delete();
        return redirect(route('expense.index'));
    }
    public function deleteexpense(Request $request)
    {
        //
        try
        {   
            $model=ExpenseModel::where('id',$request->id)->delete();
            return response()->json(['status'=>true,'message' => "Expense deleted successfully."], 200);
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
