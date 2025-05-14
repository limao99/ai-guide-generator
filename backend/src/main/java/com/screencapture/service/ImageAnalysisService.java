package com.screencapture.service;

import com.screencapture.dto.AnalysisResponse;
import org.springframework.web.multipart.MultipartFile;

public interface ImageAnalysisService {
    AnalysisResponse analyzeImage(MultipartFile imageFile, String language);
} 