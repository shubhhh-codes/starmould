<!DOCTYPE html>
<html>
<body>
    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content modal-lg modal-dialog-scrollable">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalScrollableTitle">ADD NEW SCANNING WORK</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                
                <form action="{{route('scanning.update')}}" method="post" class="needs-validation" novalidate>
                    @csrf

                    <!-- Equivalent to... -->
                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                <div class="modal-body">
                        <div class="row">
                         
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <input type="hidden" name="id" value="{{$scan->id}}">
                                    <label>Today’s Date</label>
                                    <div class="input-group" id="datepicker">
                                        <input type="text" name="rdate" class="form-control" placeholder="Pick a date"
                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker'
                                            data-provide="datepicker" data-date-autoclose="true"  value="{{$scan->rdate}}" >
        
                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                    </div><!-- input-group -->
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label>Commited Date</label>
                                    <div class="input-group" id="datepicker1">
                                        <input type="text" name="cdate" class="form-control" placeholder="Pick a date"
                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker1'
                                            data-provide="datepicker" data-date-autoclose="true" value="{{$scan->cdate}}">
        
                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                    </div><!-- input-group -->
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="validationCustom01" class="form-label">Customer Name</label>
                            <input type="text" class="form-control" id="validationCustom01" placeholder="Customer Name"
                                 name="cname" value="{{$scan->cname}}" required >
                                 
                            <div class="valid-feedback">
                                Looks good!
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="validationCustom02" class="form-label">Part Description</label>
                            <textarea class="form-control" id="validationCustom02" placeholder="Part Description"
                                 name="description" value="{{$scan->description}}" required></textarea>
                            <div class="valid-feedback">
                                Looks good!
                            </div>
                        </div>
                        <div class="row">
                            <label for="validationCustom03" class="form-label">Work Type</label>
                            <div class="col-md-3">                                                                                        
                                    <div class="form-check mb-3">
                                        <input class="form-check-input" type="radio" name="worktype" id="formRadios1" value="R.E." checked>
                                        <label class="form-check-label" for="formRadios1">
                                            R.E.
                                        </label>
                                    </div>    
                            </div>
                            <div class="col-md-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="worktype" value="Insp." id="formRadios2">
                                        <label class="form-check-label" for="formRadios2">
                                            Insp.
                                        </label>
                                    </div>  
                            </div>
                            <div class="col-md-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="worktype" value="Scan" id="formRadios3">
                                        <label class="form-check-label" for="formRadios3">
                                            Scan Only
                                        </label>
                                    </div>
                            </div>
                            <div class="col-md-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="worktype" value="Design" id="formRadios4">
                                        <label class="form-check-label" for="formRadios4">
                                            Design
                                        </label>
                                    </div>
                              
                            </div>
                        </div>
                       
                                                            
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                    <button class="btn btn-primary" type="submit">Submit form</button>
                </div>
            </form>
            </div><!-- /.modal-content -->
        </div><!-- /.modal-dialog -->
    </div>
</body>
</html>

