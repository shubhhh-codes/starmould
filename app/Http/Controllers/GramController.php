<?php

namespace App\Http\Controllers;
use App\Models\GramModel;
use Illuminate\Http\Request;
use Yajra\DataTables\DataTables as DataTables;

class GramController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        $data = GramModel::latest()->get();
        return view('gram.index',["data"=>$data]);
    }
    public function indexmobile(Request $request)
    {
        $data = GramModel::latest()->get();
        return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function updatedata(Request $request){
        //print_r($request);
        //print_r($request->id);
        $model=GramModel::findOrFail($request->id);
        $model->fix=$request->fix;
        $model->multiply=$request->multiply;
        $model->lessthan=$request->lessthan;
        $model->graterthan=$request->graterthan;
       // $model->updated_by=Auth::user()->id;
      //  $model->updated_at=Carbon::now()->toDateTimeString();
        $model->save();
    }
    public function updategramdata(Request $request)
    {
        try
        {
            $model=GramModel::findOrFail($request->id);
            $model->fix=$request->fix;
            $model->multiply=$request->multiply;
            $model->lessthan=$request->lessthan;
            $model->graterthan=$request->graterthan;
            $model->save();
            return response()->json(['status'=>true,'message' => "gram updated successfully."], 200);
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
            $data = GramModel::latest()->get();
            return DataTables::of($data)
            ->addIndexColumn()                  
            ->addColumn('action', function($row){

                $btn = '<a href="">Edit</a>';

                 return $btn;
            })         
            ->rawColumns(['action'])
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
